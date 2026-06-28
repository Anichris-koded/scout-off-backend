use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("init"),), (admin.clone(),));
}

pub fn emit_paused(env: &Env, paused: bool) {
    env.events()
        .publish((symbol_short!("pause"),), (paused,));
}
