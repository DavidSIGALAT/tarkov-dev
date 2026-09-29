import APIQuery from "../../modules/api-query.mjs";

// Extract switch links the API reports but the game doesn't require, keyed by extract id.
// Customs Dorms V-Ex only needs the rouble fee, not the ZB-013 power switch.
const ignoredExtractSwitches = {
    "75231a4542e0b910f7b303b5e65ca04951aad3cd": ["ae4bdfc1fc5b30100701158b56ae4d20840e0550"],
};

// Boss spawn zone names the API reports that don't match where their spawn points actually are,
// or that are only internal zone names.
// On Customs, ZoneGasStation points are inside the Fortress and ZoneScavBase points are around the Repair Shop.
// Terminal's Zone2ScavPort29 has no positions; its neighbouring Zone2 port zones are all in the port area.
const bossZoneNameOverrides = {
    customs: {
        ZoneGasStation: { en: "Fortress", es: "Fortaleza" },
        ZoneScavBase: { en: "Repair Shop", es: "Taller" },
        ZoneDormitory: { en: "Dorms", es: "Dormitorios" },
    },
    terminal: {
        Zone2ScavPort29: { en: "Port (sector 2)", es: "Puerto (sector 2)" },
    },
};

// Boss spawn points reported by the community that are not in the game data.
// They have no known chance, so chance is null.
const communityBossSpawns = {
    customs: [
        {
            mob: "bossBully",
            spawnKey: "CommunityNewGasStation",
            name: { en: "New Gas Station (community reported)", es: "Gasolinera nueva (según la comunidad)" },
            positions: [
                { x: 416.5, y: 1.3, z: 29 },
                { x: 414.5, y: 1.3, z: 38.5 },
            ],
        },
    ],
};

const localizedName = (names, language) => names[language] ?? names.en;

class MapsQuery extends APIQuery {
    constructor() {
        super("maps");
    }

    async query(options) {
        const { language, gameMode } = options;

        const [mapsData] = await Promise.all([this.apiRequest(`${gameMode}/maps`, { lang: language })]);

        for (const map of Object.values(mapsData.maps)) {
            for (const spawn of map.bosses) {
                spawn.id = spawn.mob;
                spawn.name = mapsData.mobs[spawn.mob].name;
                spawn.normalizedName = mapsData.mobs[spawn.mob].normalizedName;
                spawn.escorts = spawn.escorts.map((escort) => {
                    escort.id = escort.mob;
                    escort.name = mapsData.mobs[escort.mob].name;
                    escort.normalizedName = mapsData.mobs[escort.mob].normalizedName;
                    return escort;
                });
                if (spawn.switch) {
                    spawn.switch = {
                        id: spawn.switch,
                    };
                }
                const zoneNames = bossZoneNameOverrides[map.normalizedName] ?? {};
                for (const location of spawn.spawnLocations) {
                    if (zoneNames[location.spawnKey]) {
                        location.name = localizedName(zoneNames[location.spawnKey], language);
                    }
                }
            }
            for (const communitySpawn of communityBossSpawns[map.normalizedName] ?? []) {
                const bossSpawn = map.bosses.find((spawn) => spawn.mob === communitySpawn.mob);
                if (!bossSpawn) {
                    continue;
                }
                bossSpawn.spawnLocations.push({
                    name: localizedName(communitySpawn.name, language),
                    spawnKey: communitySpawn.spawnKey,
                    chance: null,
                    communityReported: true,
                    positions: communitySpawn.positions,
                });
                for (const position of communitySpawn.positions) {
                    map.spawns.push({
                        zoneName: communitySpawn.spawnKey,
                        position,
                        sides: ["scav"],
                        categories: ["boss"],
                        communityReported: true,
                    });
                }
            }
            for (const extract of map.extracts) {
                const ignoredSwitches = ignoredExtractSwitches[extract.id] ?? [];
                extract.switches = extract.switches
                    .filter((switchId) => !ignoredSwitches.includes(switchId))
                    .map((switchId) => {
                        const sw = map.switches.find((s2) => s2.id === switchId);
                        if (!sw) {
                            return;
                        }
                        return {
                            id: switchId,
                            name: sw.name,
                        };
                    });
                if (extract.transferItem) {
                    extract.transferItem.item = {
                        id: extract.transferItem.item,
                        //name: itemsData.items[extract.transferItem.item].name,
                        //normalizedName: itemsData.items[extract.transferItem.item].normalizedName,
                        //baseImageLink: itemsData.items[extract.transferItem.item].baseImageLink,
                    };
                }
            }
            for (const lock of map.locks) {
                lock.key = {
                    id: lock.key,
                };
            }
            for (const loot of map.lootContainers) {
                loot.lootContainer = {
                    id: loot.lootContainer,
                    name: mapsData.lootContainers[loot.lootContainer].name,
                    normalizedName: mapsData.lootContainers[loot.lootContainer].normalizedName,
                };
            }
            for (const loot of map.lootLoose) {
                loot.items = loot.items.map((id) => {
                    return { id };
                });
            }
            for (const sw of map.switches) {
                for (const activates of sw.activates) {
                    activates.target = {};
                    if (activates.extract) {
                        activates.target.id = activates.extract;
                        const extract = map.extracts.find((e) => e.id === activates.target.id);
                        activates.target.name = extract.name;
                        activates.target.faction = extract.faction;
                    }
                    if (activates.switch) {
                        activates.target.id = activates.switch;
                        const sw = map.switches.find((s) => s.id === activates.target.id);
                        activates.target.name = sw.name;
                    }
                }
            }
            for (const weap of map.stationaryWeapons) {
                const sw = mapsData.stationaryWeapons[weap.stationaryWeapon];
                weap.stationaryWeapon = {
                    name: sw.name,
                    shortName: sw.shortName,
                };
            }
        }

        for (const boss of Object.values(mapsData.mobs)) {
            if (boss.normalizedName === "knight") {
                boss.reports = mapsData.goonReports;
            }
            for (const equip of boss.equipment) {
                equip.item = {
                    id: equip.item,
                    containsItems: equip.contains.map((cont) => {
                        return {
                            item: { id: cont.item },
                            count: cont.count,
                            attributes: cont.attributes,
                        };
                    }),
                };
                equip.attributes = Object.keys(equip.attributes).map((attName) => {
                    return {
                        name: attName,
                        value: equip.attributes[attName],
                    };
                });
                delete equip.contains;
            }
            for (const equip of boss.items) {
                equip.item = { id: equip.item };
            }
        }

        mapsData.maps = Object.values(mapsData.maps);
        mapsData.mobs = Object.values(mapsData.mobs);

        return mapsData;
    }
}

const mapsQuery = new MapsQuery();

const doFetchMaps = async (options) => {
    return mapsQuery.run(options);
};

export default doFetchMaps;
