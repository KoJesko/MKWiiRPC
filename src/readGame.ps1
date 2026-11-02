# Reads WiiCompiled's (Retro Rewind) race state from the game's memory and prints one JSON line every 0.5s.
# Read-only: the process is opened with query + VM read rights, nothing is ever written to the game.
param([string]$CupSignature, [int]$ParentPid)

Add-Type @"
using System; using System.Runtime.InteropServices;
public static class GameMem {
  [DllImport("kernel32")] static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32")] static extern bool ReadProcessMemory(IntPtr h, long addr, byte[] buf, int n, out IntPtr read);
  const long Base = 0x100000000000L;   // kFixedFlatGuestBase in WiiCompiled's guest_abi/flat_memory.h
  public static IntPtr Open(int pid) { return OpenProcess(0x0410, false, pid); }
  public static void Close(IntPtr h) { CloseHandle(h); }
  public static byte[] Read(IntPtr h, long g, int n) { var b = new byte[n]; IntPtr r; return ReadProcessMemory(h, Base + g, b, n, out r) ? b : null; }
  public static long U32(IntPtr h, long g) { var b = Read(h, g, 4); return b == null ? 0 : ((long)b[0] << 24) | ((long)b[1] << 16) | ((long)b[2] << 8) | b[3]; }
  public static float F32(IntPtr h, long g) { var b = Read(h, g, 4); if (b == null) return 0; Array.Reverse(b); return BitConverter.ToSingle(b, 0); }
  public static long Find(IntPtr h, long start, long len, byte[] pat) {
    const int chunk = 0x40000; var buf = new byte[chunk + 32]; IntPtr r;
    for (long g = start; g < start + len; g += chunk) {
      if (!ReadProcessMemory(h, Base + g, buf, chunk + pat.Length, out r)) continue;
      for (int i = 0; i < chunk; i += 4) { int j = 0; while (j < pat.Length && buf[i + j] == pat[j]) j++; if (j == pat.Length) return g + i; }
    }
    return 0;
  }
}
"@

$MEM1 = 0x80000000L; $MEM1_SIZE = 0x1800000L
$RACE_CONFIG = 0x809BD728L; $RACE_INFO = 0x809BD730L; $KART_MANAGER = 0x809C18F8L     # PAL (RMCP) singletons
$CUSTOM_CC_OFFSET = 0x3DC0                                 # Retro Rewind's Custom cc value, relative to the cups pointer
function Valid([long]$p) { ($p -ge 0x80000000L) -and ($p -lt 0x98000000L) }

$sig = New-Object byte[] ($CupSignature.Length / 2)
for ($i = 0; $i -lt $sig.Length; $i++) { $sig[$i] = [Convert]::ToByte($CupSignature.Substring($i * 2, 2), 16) }

$attachedPid = 0; $h = [IntPtr]::Zero; $cupsConfig = 0L

while ($true) {
  if ($ParentPid -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { exit }

  $proc = Get-Process RetroRewind -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $proc) {
    if ($attachedPid) { [GameMem]::Close($h); $attachedPid = 0; $cupsConfig = 0L }
    '{"running":false}'
    Start-Sleep -Seconds 2
    continue
  }
  if ($proc.Id -ne $attachedPid) {
    if ($attachedPid) { [GameMem]::Close($h) }
    $h = [GameMem]::Open($proc.Id); $attachedPid = $proc.Id; $cupsConfig = 0L
  }

  # Pulsar's CupsConfig isn't at a fixed address: find its cups table, then the pointer to that table
  if (-not $cupsConfig) {
    $cups = [GameMem]::Find($h, $MEM1, $MEM1_SIZE, $sig)
    if ($cups) {
      $ptr = [byte[]]@((($cups -shr 24) -band 255), (($cups -shr 16) -band 255), (($cups -shr 8) -band 255), ($cups -band 255))
      $ref = [GameMem]::Find($h, $MEM1, $MEM1_SIZE, $ptr)
      if ($ref) { $cupsConfig = $ref }
    }
  }

  $out = [ordered]@{ running = $true; inRace = $false }
  $rc = [GameMem]::U32($h, $RACE_CONFIG); $ri = [GameMem]::U32($h, $RACE_INFO)
  if ((Valid $rc) -and (Valid $ri)) {
    $settings = [GameMem]::Read($h, $rc + 0xB68, 0x2C)
    $info = [GameMem]::Read($h, $ri, 0x2C)
    $playersPtr = [GameMem]::U32($h, $ri + 0x0C); $timer = [GameMem]::U32($h, $ri + 0x14)
    if ($settings -and $info -and (Valid $playersPtr) -and (Valid $timer)) {
      $hud = $settings[0x1C]; if ($hud -gt 11) { $hud = 0 }
      $player = [GameMem]::U32($h, $playersPtr + 4 * $hud)
      $mainTimer = [GameMem]::Read($h, $timer + 8, 8)
      if ((Valid $player) -and $mainTimer) {
        $racer = [GameMem]::Read($h, $player + 0x20, 1)
        $racers = [GameMem]::Read($h, $rc + 0x24, 1)
        $out.inRace = $true
        $out.engineClass = $settings[7]
        $out.gameMode = $settings[11]
        $out.mirror = [bool]($settings[0x2B] -band 1)
        $out.position = $racer[0]
        $out.racers = $racers[0]
        $out.stage = $info[0x2B]
        $out.frame = ([long]$info[0x20] -shl 24) -bor ([long]$info[0x21] -shl 16) -bor ([long]$info[0x22] -shl 8) -bor $info[0x23]
        $out.timeMs = (([int]$mainTimer[0] * 256 + $mainTimer[1]) * 60000) + ([int]$mainTimer[2] * 1000) + ([int]$mainTimer[4] * 256 + $mainTimer[5])
        $out.courseSlot = $settings[3]
        # the race's 12 player entries, 0xF0 bytes each, end where the settings start
        $entry = $rc + 0x28 + 0xF0 * $hud
        $out.vehicle = [GameMem]::U32($h, $entry + 0x08)
        $out.character = [GameMem]::U32($h, $entry + 0x0C)
        if ($cupsConfig) {
          $out.pulsarId = [GameMem]::U32($h, $cupsConfig - 0x38)
          $out.variant = ([GameMem]::Read($h, $cupsConfig - 0x34, 1))[0]
          $customCc = [GameMem]::Read($h, $cupsConfig + $CUSTOM_CC_OFFSET, 2)
          if ($customCc) { $out.customCc = [int]$customCc[0] * 256 + $customCc[1] }
        }
        $karts = [GameMem]::U32($h, $KART_MANAGER)
        if (Valid $karts) {
          $kart = [GameMem]::U32($h, ([GameMem]::U32($h, $karts + 0x20)) + 4 * $hud)
          $move = [GameMem]::U32($h, ([GameMem]::U32($h, $kart)) + 0x28)
          if (Valid $move) {
            $out.speed = [Math]::Round([GameMem]::F32($h, $move + 0x20), 1)
            $out.hardSpeedLimit = [Math]::Round([GameMem]::F32($h, $move + 0x2C), 1)
          }
        }
      }
    }
  }
  $out | ConvertTo-Json -Compress
  Start-Sleep -Milliseconds 500
}
