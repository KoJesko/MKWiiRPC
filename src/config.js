export const FRIEND_CODE = "0000-0000-0000";                    //your friend code on Retro WFC (Retro Rewind) / it's the end of your profile link e.g. https://rwfc.net/player/0000-0000-0000
export const BASE_URL = "https://rwfc.net";
export const ROOM_STATUS_URL = `${BASE_URL}/api/roomstatus`;
export const RETRO_REWIND_ROOT = "C:/path/to/RetroRewind6";   //retro_rewind_root in WiiCompiled's Config.toml, used for track names
export const DISCORD_CLIENT_ID = "1429941165310087178";
//mostly ignore changing the ones without a comment, unless you really want to change something
export const POLL_INTERVAL = 15 * 1000;
export const MAX_PLAYERS = 12;                                  //change this if you (for some reason) have more or less than 12 players max
export const PUPPETEER_PROFILE_DIR = "./puppeteer_profile";

export const LARGE_IMAGE_KEY = "https://i.postimg.cc/2Sk06zR9/928pgfv1vafh1.jpg"; // Retro Rewind cover
export const SMALL_IMAGE_KEY = "mii_avatar";
export const OFFLINE_SMALL_KEY = "wiimmfi_offline";
export const VOTING_IMAGE_VERSUS_KEY = "voting_versus";
export const VOTING_IMAGE_BATTLE_KEY  = "voting_battle";

export const LANGUAGE = process.env.APP_LANGUAGE || "en-us";    //check the locals folder for all the available languages
export const DEBUG_MODE = false;                                //enable this if you need to debug, will cause a bunch of chaos in logs
