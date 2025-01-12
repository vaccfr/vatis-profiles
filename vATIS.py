import os, json
from pathlib import Path

VATIS_PROFILES_PATH="/Users/Goulven/dev/vatis-profiles"
EUROSCOPE_ESE_PATH="/Users/Goulven/Library/CloudStorage/OneDrive-Personal/Documents/EuroScope/LFXX.ese"
EUROSCOPE_VC_PATH="/Users/Goulven/Library/CloudStorage/OneDrive-Personal/Documents/EuroScope/LFXX/Settings/VoiceChannels.txt"

file = open(EUROSCOPE_ESE_PATH, "r", encoding="cp1252")
ese_sids = {}
for line in file.readlines():
    if ("SID:" in line):
        fields = line.split(":")
        key = fields[1] + "/" + fields[2]
        if (key in ese_sids):
            ese_sids[key].append(fields[3])
        else:
            ese_sids[key] = [fields[3]]
file.close()

vatis_airports = []
for file in Path(VATIS_PROFILES_PATH).glob('*.json'):
    print(f"Loading {file} ------------------------------------------")
    with open(file, 'r') as jsonfile:
        fir = json.load(jsonfile)
        for composite in fir["composites"]:
            vatis_airports.append(composite['identifier'])
            print(f"{composite['identifier']} -- {composite['name']}")
            for preset in composite["presets"]:
                print(f"    * {preset['name']}: {preset['airportConditions']}")
            for airportrwy in ese_sids:
                if (composite['identifier'] in airportrwy):
                    print(f"    @ {airportrwy}: {ese_sids[airportrwy]}")

missing_airports = []
file = open(EUROSCOPE_VC_PATH, "r", encoding="cp1252")
for line in file.readlines():
    if ("AG:" in line and "_ATIS" in line):
        airport = line.split(":")[4].rstrip().replace("_ATIS", "")
        if airport not in vatis_airports:
            missing_airports.append(airport)
print(f"Found {len(vatis_airports)} airports")
print(f"Found {len(missing_airports)} missing airports: {missing_airports}")