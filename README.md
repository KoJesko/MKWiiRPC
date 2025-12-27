# Mario Kart Wii Rich Presence

<p>This small Javascript Program allows you to share your Mario Kart Wii Wiimmfi Online Details on Discord with it's rich presence feature!</p>
<p>You will need a Computer running the entire time with the program open</p>
<p>You can use this on Original Hardware, Emulators anything that can connect to Mario Kart Wii Online on the Wiimmfi Servers.</p>

## Disclaimer

This project is a fan-made tool and is not affiliated with or endorsed by Nintendo.
Mario Kart Wii and all related names are trademarks of Nintendo.
No copyrighted game assets are included in this repository.

## Notes
> [!WARNING]
> The Program will often not display the correct amount of players or show you're in a room, this is due to the Wiimmfi website (sometimes) not showing the correct data.
> I can't really do much about it except pray it does work.

> [!IMPORTANT]
> This only works with Wiimmfi and Mario Kart Wii, you cannot play other games on Wiimmfi and expect the program to work.
> Same goes for other servers, this program is only used for Mario Kart Wii on Wiimmfi and nothing else.

## Download

Either Download the [latest release](https://github.com/ArianLust/MKWiiRPC/releases/latest) or download the Source Code to build the Program's Modules yourself.

## Instructions
<ol>

<li> Clone the repository or download a prebuilt release
<li> Run npm ci to get all the modules up and running at the same version of this project (this is only required if you downloaded the sorurce code)
<li> Under src/config.js insert your pid from Wiimmfi on the SELF_PATH_SEGMENT (read the comment or watch the tutorial video below)
<li> Run npm start and you should be good to go!
</ol>
<p>Tutorial Video: https://www.youtube.com/watch?v=yThQYEeNr1M
<details>
<summary><h2>Common Issues</h2></summary>

> After loading the program you're sometimes asked to solve a captcha from Cloudflare, this is easier done than said but closing the Browser Window after that will break the program.

* Solution: Restart after solving the captcha should hide the Window fully. This only happens rarely and mostly when you first use the program.

> throw new Error("i18n: LANGUAGE is not set in config.js — aborting startup (no fallback)."); ???

* Solution: You either deleted the LANGUAGE from config.js or I forgot to put it in ¯\\\_(ツ)_/¯

> throw new Error("i18n: LANGUAGE is not set in config.js — aborting startup (no fallback)."); ???

* Solution: Check if your config.js' SELF_PATH_SEGMENT is correctly set to your PID on Wiimmfi, if not then go do that, the comment and the Video say how to.

> My Activity is inaccurate!

* Yeah uhhh, that is pretty difficult to solve, this is an issue from Wiimmfi's side, it doesn't seem to display the values correctly, can't do much sadly.

> My Activity says In an Unknown Room or just In a Room!

* Another issue I cannot solve, the GLOBAL_STATS_URL is showing that you're in a room but it doesn't know which one since the SELF_WATCH_URL doesn't display any results, best bet is to accept it or find another room, Midnight in Europe is a bad time to look for rooms by the way from personal experience!
</details>

<details>
<summary><h2>How To Mod</h2></summary>
<p>If you wish to create Custom Discord Rich Presence for your own MKWii Mod (which has to connect and be playable on Wiimmfi) you can simply fork this Repository
<p>Here are some Steps to watch out for
<ul>
<li> Create a Discord Application, the name of the Application is what will be shown as "the game" you're playing, e.g. Mario Kart Wii The Best Mod Wow XD, upload images for
<ul>
<li>mkwii_large (Coverart)
<li>mii_avatar (The Icon with Mii Name, friendcode VR or BR)
<li>wiimmfi_offline (The Icon from the last thing, showing when you're offline)
<li>voting_versus (Image replacing the Coverart when you're voting for a Race Track)
<li>voting_battle (Image replacing the Coverart when you're voting for a Battle Map)
</ul>
<li>To add custom maps, play a match on your Custom Map and check your Room for the Last Track: (Whatever is on there), usually there is a SHA1 hash on it like the one below, take note of the hash and open your trackMap.js, in your fork, and add the map's hash, following up by the image key, to show on Discord and the translation key, so it actually shows a name instead of just the Hash.</li>
</ul>

> "Last Track SHA1: dd5f14777ee0b78c0bd5f6fda04ea71104f84bf7" 

<p>If you need help creating this for an MKWii Mod, feel free to open an Issue.

</details>

<details>
<summary><h2>Credits</h2></summary>

### Creator:

* [ArianLust](https://github.com/ArianLust)

### Contributors:

* [Moddimation](https://github.com/Moddimation)

### Playtesters:

* [Moddimation](https://github.com/Moddimation)

</details>