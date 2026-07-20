import request from "supertest";
import app from "../../src/app";
import { Keypair, Transaction, Networks } from "@stellar/stellar-sdk";
import { getDb, upsertPlayer } from "../../src/db";
import { invalidatePlayerCache } from "../../src/services/cache";

/**
 * Helper: obtain a JWT for the given role using a specific keypair.
 * This allows the token's wallet (sub claim) to match the player's wallet
 * so that requireOwner middleware passes.
 */
async function getTokenForWallet(kp: Keypair, role: string): Promise<string> {
  const challengeRes = await request(app).get(
    `/auth/challenge?account=${kp.publicKey()}`
  );
  const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
  tx.sign(kp);
  const tokenRes = await request(app)
    .post("/auth/token")
    .send({ transaction: tx.toXDR(), role });
  return tokenRes.body.token;
}

/**
 * Helper: obtain a JWT for the given role using a random keypair.
 */
async function getToken(role: string): Promise<string> {
  return getTokenForWallet(Keypair.random(), role);
}

/**
 * Helper: create a player record directly in SQLite for test isolation.
 * Uses the wallet as the player_id so that requireOwner middleware passes.
 * Always sets is_active explicitly (upsertPlayer does not touch it).
 * Busts relevant cache entries so GETs read fresh from DB.
 */
function createTestPlayer(
  wallet: string,
  overrides: Partial<{
    region: string;
    position: string;
    is_active: number;
  }> = {}
): string {
  const playerId = wallet;
  upsertPlayer({
    player_id: playerId,
    wallet,
    position: overrides.position ?? "Forward",
    region: overrides.region ?? "Europe",
    created_at: Math.floor(Date.now() / 1000),
  });
  // Always set is_active explicitly since upsertPlayer does not touch it
  getDb()
    .prepare("UPDATE players SET is_active = ? WHERE player_id = ?")
    .run(overrides.is_active ?? 1, playerId);
  // Bust cache so direct GETs and list GETs read fresh from DB
  invalidatePlayerCache(playerId);
  return playerId;
}

/**
 * Clean up the players table between tests so each test starts fresh.
 */
function cleanPlayers(): void {
  getDb().prepare("DELETE FROM players").run();
  invalidatePlayerCache();
}

// ─── Deactivate Auth Guards ───────────────────────────────────────────────────

describe("POST /api/players/:playerId/deactivate — auth guards", () => {
  afterEach(cleanPlayers);

  it("returns 401 with no token", async () => {
    const res = await request(app).post(
      "/api/players/some-player-id/deactivate"
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner player", async () => {
    const token = await getToken("player");
    const playerWallet = Keypair.random().publicKey();
    createTestPlayer(playerWallet);

    const res = await request(app)
      .post(`/api/players/${playerWallet}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a scout (wrong role)", async () => {
    const token = await getToken("scout");
    const playerWallet = Keypair.random().publicKey();
    createTestPlayer(playerWallet);

    const res = await request(app)
      .post(`/api/players/${playerWallet}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── Reactivate Auth Guards ───────────────────────────────────────────────────

describe("POST /api/players/:playerId/reactivate — auth guards", () => {
  afterEach(cleanPlayers);

  it("returns 401 with no token", async () => {
    const res = await request(app).post(
      "/api/players/some-player-id/reactivate"
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner player", async () => {
    const token = await getToken("player");
    const playerWallet = Keypair.random().publicKey();
    createTestPlayer(playerWallet, { is_active: 0 });

    const res = await request(app)
      .post(`/api/players/${playerWallet}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── Deactivation Flow ────────────────────────────────────────────────────────

describe("Deactivation flow — deactivate → excluded from search → still accessible to owner/admin", () => {
  afterEach(cleanPlayers);

  it("owner can deactivate their profile", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const token = await getTokenForWallet(kp, "player");

    const res = await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("deactivated");

    const row = getDb()
      .prepare("SELECT is_active FROM players WHERE player_id = ?")
      .get(playerId) as { is_active: number };
    expect(row.is_active).toBe(0);
  });

  it("deactivated player is excluded from GET /api/players list", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const token = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    const listRes = await request(app).get("/api/players");
    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();
  });

  it("deactivated player is excluded from filtered search", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, {
      region: "Europe",
      position: "Forward",
    });
    const token = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    const searchRes = await request(app)
      .get("/api/players")
      .query({ position: "Forward", region: "Europe" });
    expect(searchRes.status).toBe(200);
    const found = searchRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();
  });

  it("deactivated player direct GET returns 404 for unauthenticated users", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const token = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/api/players/${playerId}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PLAYER_NOT_FOUND");
  });

  it("deactivated player direct GET returns 404 for a different authenticated player", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const otherToken = await getToken("player");
    const res = await request(app)
      .get(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it("deactivated player direct GET still works for the owner", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const res = await request(app)
      .get(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.player_id).toBe(playerId);
    expect(res.body.data.is_active).toBe(0);
  });

  it("deactivated player direct GET still works for admin", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const adminToken = await getToken("admin");
    const res = await request(app)
      .get(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.player_id).toBe(playerId);
  });
});

// ─── Milestones accessibility when deactivated ─────────────────────────────────

describe("Milestones access for deactivated player", () => {
  afterEach(cleanPlayers);

  it("deactivated player milestones return 404 for non-owner/non-admin", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const res = await request(app).get(`/api/players/${playerId}/milestones`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PLAYER_NOT_FOUND");
  });

  it("deactivated player milestones still accessible to owner", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const res = await request(app)
      .get(`/api/players/${playerId}/milestones`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("deactivated player milestones still accessible to admin", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet);
    const ownerToken = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const adminToken = await getToken("admin");
    const res = await request(app)
      .get(`/api/players/${playerId}/milestones`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Reactivation Flow ────────────────────────────────────────────────────────

describe("Reactivation flow — reactivate → visible again in search", () => {
  afterEach(cleanPlayers);

  it("owner can reactivate their profile", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, { is_active: 0 });
    const token = await getTokenForWallet(kp, "player");

    const res = await request(app)
      .post(`/api/players/${playerId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("reactivated");

    const row = getDb()
      .prepare("SELECT is_active FROM players WHERE player_id = ?")
      .get(playerId) as { is_active: number };
    expect(row.is_active).toBe(1);
  });

  it("player appears in list/search after reactivation", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, {
      region: "South America",
      position: "Midfielder",
    });
    const token = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    let listRes = await request(app).get("/api/players");
    let found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();

    await request(app)
      .post(`/api/players/${playerId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);

    listRes = await request(app).get("/api/players");
    found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeDefined();
    expect(found.is_active).toBe(1);
  });

  it("player appears in filtered search after reactivation", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, {
      region: "Africa",
      position: "Defender",
    });
    const token = await getTokenForWallet(kp, "player");

    await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    let searchRes = await request(app)
      .get("/api/players")
      .query({ position: "Defender", region: "Africa" });
    let found = searchRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();

    await request(app)
      .post(`/api/players/${playerId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);

    searchRes = await request(app)
      .get("/api/players")
      .query({ position: "Defender", region: "Africa" });
    found = searchRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeDefined();
    expect(found.is_active).toBe(1);
  });

  it("deactivation is idempotent (deactivating an already deactivated profile returns 200)", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, { is_active: 0 });
    const token = await getTokenForWallet(kp, "player");

    const res = await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Invalid player ID handling ───────────────────────────────────────────────

describe("Deactivate/reactivate — invalid player ID", () => {
  it("returns 405 for an empty player ID segment on deactivate", async () => {
    const token = await getToken("player");
    const res = await request(app)
      .post("/api/players//deactivate")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(405);
  });

  it("returns 404 when deactivating a non-existent player", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const token = await getTokenForWallet(kp, "player");

    const res = await request(app)
      .post(`/api/players/${wallet}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PLAYER_NOT_FOUND");
  });

  it("returns 404 when reactivating a non-existent player", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const token = await getTokenForWallet(kp, "player");

    const res = await request(app)
      .post(`/api/players/${wallet}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PLAYER_NOT_FOUND");
  });
});

// ─── Full Cycle Test ──────────────────────────────────────────────────────────

describe("Full deactivate → excluded → reactivate → visible cycle", () => {
  afterEach(cleanPlayers);

  it("completes the full lifecycle: active → deactivated → excluded → reactivated → visible", async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();
    const playerId = createTestPlayer(wallet, {
      region: "Asia",
      position: "Goalkeeper",
    });
    const token = await getTokenForWallet(kp, "player");

    // 1. Initially visible in list
    let listRes = await request(app).get("/api/players");
    let found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeDefined();
    expect(found.is_active).toBe(1);

    // 2. Deactivate
    const deactRes = await request(app)
      .post(`/api/players/${playerId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(deactRes.status).toBe(200);

    // 3. Excluded from list
    listRes = await request(app).get("/api/players");
    found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();

    // 4. Excluded from filtered search
    const searchRes = await request(app)
      .get("/api/players")
      .query({ position: "Goalkeeper", region: "Asia" });
    found = searchRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeUndefined();

    // 5. Still accessible to owner directly (but shows is_active=0)
    const ownerGetRes = await request(app)
      .get(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(ownerGetRes.status).toBe(200);
    expect(ownerGetRes.body.data.is_active).toBe(0);

    // 6. Reactivate
    const reactRes = await request(app)
      .post(`/api/players/${playerId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(reactRes.status).toBe(200);

    // 7. Visible again in list
    listRes = await request(app).get("/api/players");
    found = listRes.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeDefined();
    expect(found.is_active).toBe(1);

    // 8. Visible again in filtered search
    const searchRes2 = await request(app)
      .get("/api/players")
      .query({ position: "Goalkeeper", region: "Asia" });
    found = searchRes2.body.data.find(
      (p: { player_id: string }) => p.player_id === playerId
    );
    expect(found).toBeDefined();
    expect(found.is_active).toBe(1);
  });
});
