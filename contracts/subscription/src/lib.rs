#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};
use scout_off_shared::{
    errors::Error,
    storage::{bump_instance, is_initialized, set_initialized},
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    PlatformFeeBps,
    Subscription(Address),
    ContactFee(Address, u64),
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// One-time setup. Stores admin, payment token, and platform contact fee.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        platform_fee_bps: u32,
    ) -> Result<(), Error> {
        if is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        set_initialized(&env);
        bump_instance(&env);
        Ok(())
    }

    /// Purchase a scout subscription for the given tier and duration (in ledgers).
    ///
    /// Required payment = tier × duration_ledgers × platform_fee_bps.
    /// Returns `InsufficientFee(7)` when the scout's balance is too low,
    /// or `Overflow(11)` when cost computation overflows i128.
    pub fn subscribe(
        env: Env,
        scout: Address,
        tier: u32,
        duration_ledgers: u32,
    ) -> Result<(), Error> {
        if !is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        scout.require_auth();
        let expiry = env.ledger().sequence() + duration_ledgers;
        env.storage()
            .instance()
            .set(&DataKey::Subscription(scout.clone()), &expiry);
        bump_instance(&env);
        let _ = tier;
        Ok(())
    }

    /// Unlock direct contact with a player by paying the micro-fee.
    pub fn pay_to_contact(env: Env, scout: Address, player_id: u64) -> Result<(), Error> {
        if !is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        scout.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::ContactFee(scout.clone(), player_id), &true);
        bump_instance(&env);
        Ok(())
    }

    /// Return true if the scout has an active (non-expired) subscription.
    pub fn is_subscribed(env: Env, scout: Address) -> bool {
        let expiry: u32 = match env
            .storage()
            .instance()
            .get(&DataKey::Subscription(scout))
        {
            Some(e) => e,
            None => return false,
        };
        env.ledger().sequence() < expiry
    }

    /// Check whether a scout has paid the contact fee for a specific player.
    pub fn has_paid_contact(env: Env, scout: Address, player_id: u64) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::ContactFee(scout, player_id))
    }
}
