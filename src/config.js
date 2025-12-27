export const SELF_PATH_SEGMENT = "";                                          //your pid on wiimmfi / you can find it under https://wiimmfi.de/stats/game/mariokartwii if you search for your mii name or friendcode, add a p at the beginning of the numbers e.g. "p439614847"
export const SELF_WATCH_URL = `https://wiimmfi.de/stats/mkw/room/${SELF_PATH_SEGMENT}`;
export const GLOBAL_STATS_URL = "https://wiimmfi.de/stats/game/mariokartwii";
export const DISCORD_CLIENT_ID = "1429941165310087178";
//mostly ignore changing the ones without a comment, unless you really want to change something
export const POLL_INTERVAL = 15 * 1000;         
export const MAX_PLAYERS = 12;                                  //change this if you (for some reason) have more or less than 12 players max
export const PUPPETEER_PROFILE_DIR = "./puppeteer_profile";     
export const BASE_URL = "https://wiimmfi.de";

export const LARGE_IMAGE_KEY = "mkwii_large";
export const SMALL_IMAGE_KEY = "mii_avatar";
export const OFFLINE_SMALL_KEY = "wiimmfi_offline";
export const VOTING_IMAGE_VERSUS_KEY = "voting_versus"; 
export const VOTING_IMAGE_BATTLE_KEY  = "voting_battle";

export const LANGUAGE = process.env.APP_LANGUAGE || "en-us";    //check the locals folder for all the available languages
export const DEBUG_MODE = false;                                //enable this if you need to debug, will cause a bunch of chaos in logs
