use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    PlayerNotFound = 3,
    NotFound = 4,
    InvalidInput = 5,
    Unauthorized = 9,
    ContractPaused = 10,
}
