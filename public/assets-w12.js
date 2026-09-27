// KUSH QUEST - World 1 + World 2 content pack assets (v1.4 proposal).
// Pure data: string-row pixel sprites in the SAME format as game.js (see sprite()/P there).
// Load BEFORE game.js in index.html:  <script src="assets-w12.js"></script>
// game.js turns each entry into canvases with: KQ_W12.build(sprite, P)  -> { id: [canvas per frame] }
// Every sprite faces RIGHT by default (flip when dir < 0), like COP_ROWS. See docs/BRIEF_v1.4_W12.md.
window.KQ_W12 = {
  assets: {
    jogger: { group: 'enemy', note: "W1 Charger. Frames: idle, run, charge (head-down lean).", frameNames: ["idle", "run", "charge"], pal: {},
      frames: [
        ["....kkkkkkk.....", "...khhhhhhhk....", "..khhhhhhhhhk...", "..krrrrrrrrrk...", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk...", "..ksssskksssw...", "...kssssssk.w...", "....kkkkkk..w...", "...kwwwwwwk.....", "..kswwwwwwsk....", "..kskwwrwwksk...", "...kkwwwwwkk....", "...krrrrrrk.....", "...ksk..ksk.....", "...ksk..ksk.....", "..kvvk..kvvk...."],
        ["....kkkkkkk.....", "...khhhhhhhk....", "..khhhhhhhhhk...", "..krrrrrrrrrk...", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk...", "..ksssskksssw...", "...kssssssk.w...", "....kkkkkk..w...", "...kwwwwwwk.....", "..kswwwwwwsk....", "..kskwwrwwksk...", "...kkwwwwwkk....", "...krrrrrrk.....", "..ksk....ksk....", ".ksk......ksk...", "kvvk......kvvk.."],
        [".......kkkkkkk..", "......khhhhhhhk.", ".....khhhhhhhhhk", ".....krrrrrrrrrk", ".....kssssssssk.", ".....kskkssskksk", ".....ksssssssssk", ".....ksssskksssw", "......kssssssk.w", ".......kkkkkk..w", "....kwwwwwwk....", "...kswwwwwwsk...", "..kskwwrwwkssk..", "...kkwwwwwkk....", "...krrrrrrk.....", "..ksk....ksk....", ".ksk......ksk...", "kvvk......kvvk.."],
      ] },
    pigeon: { group: 'enemy', note: "W1 Flyer+Swarm. 3-5 per flock. Frames: wings down, wings up, dive.", frameNames: ["flapA", "flapB", "dive"], pal: {},
      frames: [
        ["....kkk.....", "...kMMwk....", "...kMMMok...", "..kkqmmkk...", ".kmmmmmmmk..", "kmmMMMmmmmkk", ".kkmmmmmkk..", "....k..k...."],
        ["....kkk.....", "...kMMwk....", "...kMMMok...", ".kmkqmmkk...", "kmmkmmmmmk..", "kmmMMMmmmmkk", ".kkmmmmmkk..", "....k..k...."],
        ["............", "..kkk.......", ".kMMwk......", ".kMMMokk....", "..kkqmmmkk..", "...kmMMMmmk.", "....kkmmmmkk", "......kkkk.."],
      ] },
    dog: { group: 'enemy', note: "W1 Swarm unit released by the Dog Walker. Frames: trot A, trot B, bite.", frameNames: ["trotA", "trotB", "bite"], pal: {},
      frames: [
        [".........kk...", ".k......knnk..", "knk.kkkkknwnk.", ".knnnnnnrnnnk.", "..knnNnnnnnk..", "..knnnnnnnk...", "..knk...knk...", "..kk.....kk..."],
        [".........kk...", ".k......knnk..", "knk.kkkkknwnk.", ".knnnnnnrnnnk.", "..knnNnnnnnk..", "..knnnnnnnk...", "...knk.knk....", "...kk...kk...."],
        [".........kk...", ".k......knnkk.", "knk.kkkkknwnkk", ".knnnnnnrnnnwk", "..knnNnnnnnk..", "..knnnnnnnk...", "..knk...knk...", "..kk.....kk..."],
      ] },
    dogwalker: { group: 'enemy', note: "W1 Summoner. Visor + green tracksuit + leashes. Frames: idle (leash down), release (arm out, leash snaps).", frameNames: ["idle", "release"], pal: {"h": "#c87a3a", "H": "#8a5024", "p": "#3fae5a", "q": "#2a7a3a"},
      frames: [
        ["...kkkkkkkk.....", "..krrrrrrrrrk...", ".kkkkkkkkkkkkk..", ".khhhHhhhhhhhhk.", ".khhkssssssshhk.", ".khkkskkskkskhk.", ".khskskkskksshk.", "..kssssssssshk..", "..kssskkkksshk..", "...ksssssssk....", "....kkkkkkk.....", "...kppppppppk...", "..kpppqpppppk...", "..kpkppppppkpk..", "..kskppppppkskN.", "...kpppppppk..N.", "....kmk.kmk...N.", "...kkkk.kkkk..NN"],
        ["...kkkkkkkk.....", "..krrrrrrrrrk...", ".kkkkkkkkkkkkk..", ".khhhHhhhhhhhhk.", ".khhkssssssshhk.", ".khkkskkskkskhk.", ".khskskkskksshk.", "..kssssssssshk..", "..kssskkkksshk..", "...ksssssssk....", "....kkkkkkk.....", "...kppppppppk...", "..kpppqpppppkss.", "..kpkppppppkNNN.", "..kskpppppppk..N", "...kpppppppk...N", "....kmk.kmk....N", "...kkkk.kkkk...."],
      ] },
    parkranger: { group: 'enemy', note: "W1 Chaser+whistle. Replaces the ranger TINT. Frames: idle, whistle (arm up, whistle at mouth).", frameNames: ["idle", "whistle"], pal: {"d": "#5a7a3a", "D": "#3a5028"},
      frames: [
        ["......kkk.......", "....kkTtTkk.....", "...kttttttttk...", "kkkkTTTTTTTTkkkk", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk...", "..kssNNNNNssk...", "...kssssssk.....", "....kkkkkk......", "..kkdddddddkk...", ".kddddyddddddk..", ".kdkdddddddkdk..", ".kskdddddddksk..", "..kkDDDDDDDkk...", "...kDDk.kDDk....", "...kDDk.kDDk....", "..kkkkk.kkkkk..."],
        ["......kkk.......", "....kkTtTkk.....", "...kttttttttk...", "kkkkTTTTTTTTkkkk", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk.w.", "..kssNNNNNsskyy.", "...kssssssk.....", "....kkkkkk......", "..kkdddddddkk...", ".kddddyddddddk..", ".kdkddddddddkssk", ".kskdddddddkk...", "..kkDDDDDDDkk...", "...kDDk.kDDk....", "...kDDk.kDDk....", "..kkkkk.kkkkk..."],
      ] },
    scout: { group: 'enemy', note: "W1 Thief. Replaces the scout TINT with beret + red merit sash (keeps the GitHub tint colours).", frameNames: ["idle", "run"], pal: {"t": "#6a8a4a", "T": "#3a5a28", "y": "#d8c890"},
      frames: [
        [".kkk.....kkk..", "kgggk...kttTk.", ".kttk..kttttTk", "kttwkk.kttttTk", "kttkttk.ktttTk", "kyttttk.ktttk.", ".krttkkttttk..", "..ktrrytttk...", "..ktyrrttk....", "...ktttttk....", "..kTk..kTk....", "..kk...kk....."],
        [".kkk.....kkk..", "kgggk...kttTk.", ".kttk..kttttTk", "kttwkk.kttttTk", "kttkttk.ktttTk", "kyttttk.ktttk.", ".krttkkttttk..", "..ktrrytttk...", "..ktyrrttk....", "...ktttttk....", ".kTk....kTk...", ".kk.....kk...."],
      ] },
    goldsquirrel: { group: 'enemy', note: "W1 Secret elite. Plain squirrel rows, gold palette (draw a sparkle particle every ~8 frames).", frameNames: ["idle", "run"], pal: {"t": "#ffd84a", "T": "#c8a030", "y": "#fff6b0", "w": "#ffffff"},
      frames: [
        [".........kkk..", "..kk....kttTk.", ".kttk..kttttTk", "kttwkk.kttttTk", "kttkttk.ktttTk", "kyttttk.ktttk.", ".kttttkkttttk.", "..kttyytttk...", "..ktyyyttk....", "...ktttttk....", "..kTk..kTk....", "..kk...kk....."],
        [".........kkk..", "..kk....kttTk.", ".kttk..kttttTk", "kttwkk.kttttTk", "kttkttk.ktttTk", "kyttttk.ktttk.", ".kttttkkttttk.", "..kttyytttk...", "..ktyyyttk....", "...ktttttk....", ".kTk....kTk...", ".kk.....kk...."],
      ] },
    crab: { group: 'enemy', note: "W2 Chaser. Real sprite (replaces crab TINT). Moves sideways (fast X, slow Z). Frames: scuttle A, B, pinch (claws closed).", frameNames: ["scuttleA", "scuttleB", "pinch"], pal: {},
      frames: [
        [".kk..........kk.", "krrk........krrk", "kRrrk......krrRk", "krkrk.k..k.krkrk", ".kkrk.w..w.krkk.", "...kkkkkkkkkk...", "..krrrrrrrrrrk..", ".krrwrrrrrrwrrk.", ".kRrrrrrrrrrrRk.", "..kRRRRRRRRRRk..", "..k.k.k..k.k.k..", ".k..k.k..k.k..k."],
        [".kk..........kk.", "krrk........krrk", "kRrrk......krrRk", "krkrk.k..k.krkrk", ".kkrk.w..w.krkk.", "...kkkkkkkkkk...", "..krrrrrrrrrrk..", ".krrwrrrrrrwrrk.", ".kRrrrrrrrrrrRk.", "..kRRRRRRRRRRk..", "...k.k.kk.k.k...", "..k.k..kk..k.k.."],
        ["................", ".kk..........kk.", "krrkk......kkrrk", "kRrrk.k..k.krrRk", ".kkrk.w..w.krkk.", "...kkkkkkkkkk...", "..krrrrrrrrrrk..", ".krrwrrrrrrwrrk.", ".kRrrrrrrrrrrRk.", "..kRRRRRRRRRRk..", "..k.k.k..k.k.k..", ".k..k.k..k.k..k."],
      ] },
    treasurecrab: { group: 'enemy', note: "W2 Secret elite. Crab wearing a gold treasure shell. 3x HP, drops Resin jackpot.", frameNames: ["idle", "scuttle"], pal: {"r": "#ff7a4a"},
      frames: [
        [".kk..........kk.", "krrk........krrk", "kRrrk......krrRk", "krkrk.k..k.krkrk", ".kkrk.w..w.krkk.", "..kkkkkkkkkkkk..", ".kyyyyyyyyyyyyk.", "kyYyyOyyyOyyyYyk", ".kOyyyyyyyyyyOk.", "..kOOOOOOOOOOk..", "..k.k.k..k.k.k..", ".k..k.k..k.k..k."],
        [".kk..........kk.", "krrk........krrk", "kRrrk......krrRk", "krkrk.k..k.krkrk", ".kkrk.w..w.krkk.", "..kkkkkkkkkkkk..", ".kyyyyyyyyyyyyk.", "kyYyyOyyyOyyyYyk", ".kOyyyyyyyyyyOk.", "..kOOOOOOOOOOk..", "...k.k.kk.k.k...", "..k.k..kk..k.k.."],
      ] },
    seagull: { group: 'enemy', note: "W2 Flyer+Thief. Steals the quick item. Frames: glide, flap, grab (holding the stolen item - draw the actual item icon over rows 8-9).", frameNames: ["glide", "flap", "grab"], pal: {},
      frames: [
        ["..........kk..", ".........kwwk.", "........kwwkwo", ".kkk....kwwwk.", "kWWWkk.kwwwk..", ".kWWWWkwwwwk..", "..kWWWWwwwwwk.", "...kEEWwwwwwk.", "....kkkwwwkk..", ".......k..k..."],
        ["..........kk..", ".........kwwk.", "........kwwkwo", "..............", ".kkkk..kwwwk..", "kWWWWkkwwwwk..", ".kEEWWwwwwwwk.", "..kkEEWwwwwwk.", "....kkkwwwkk..", ".......k..k..."],
        ["..........kk..", ".........kwwk.", "...kk...kwwkwo", "..kWWk..kwwwk.", ".kWWWWkkwwwk..", "kWWWWWwwwwwk..", ".kkkkWwwwwwwk.", ".....kwwwwkk..", ".....kyk.kyk..", ".....kmmmmk..."],
      ] },
    beachbro: { group: 'enemy', note: "W2 Grabber. 18x19, spray-tan, tank top, board shorts. Frames: idle, flex (super armor), grab (arms out).", frameNames: ["idle", "flex", "grab"], pal: {"s": "#e8964a", "S": "#b8662a"},
      frames: [
        [".....kkkkkk.......", "....kNNNNNNk......", "...kNNNNNNNNk.....", "...ksssssssk......", "...kskkskkssk.....", "...ksssssssk......", "...kssswwwssk.....", "....kssssssk......", "..kkkkkkkkkkkk....", ".ksssrrrrrrsssk...", "kssssrrrrrrssssk..", "kssSkrrrrrrkSssk..", "ksskrrrrrrrrksk...", ".kk.krrrrrrk.kk...", "....kvvvvvvk......", "....kvvkkvvk......", "....kssk.ssk......", "....kssk.ssk......", "...kkkkk.kkkk....."],
        [".....kkkkkk.......", "....kNNNNNNk......", "...kNNNNNNNNk.....", "...ksssssssk......", "...kskkskkssk.....", "...ksssssssk......", "...kssswwwssk.....", "....kssssssk......", ".kk.kkkkkkkk.kk...", "kSsk.rrrrrr.kSsk..", "kssk.rrrrrr.kssk..", "kssskrrrrrrkssk...", ".kkkrrrrrrrrkkk...", ".kk.krrrrrrk.kk...", "....kvvvvvvk......", "....kvvkkvvk......", "....kssk.ssk......", "....kssk.ssk......", "...kkkkk.kkkk....."],
        [".....kkkkkk.......", "....kNNNNNNk......", "...kNNNNNNNNk.....", "...ksssssssk......", "...kskkskkssk.....", "...ksssssssk......", "...kssswwwssk.....", "....kssssssk......", "..kkkkkkkkkkkk....", ".ksssrrrrrrsssssk.", "kssssrrrrrrkkkssk.", "kssSkrrrrrrk..kk..", "ksskrrrrrrrk......", ".kk.krrrrrrk.kk...", "....kvvvvvvk......", "....kvvkkvvk......", "....kssk.ssk......", "....kssk.ssk......", "...kkkkk.kkkk....."],
      ] },
    metaldetector: { group: 'enemy', note: "W2 Planter. Visor, beige shirt, metal detector. Frames: sweep, dig (sand kicked up).", frameNames: ["sweep", "dig"], pal: {"d": "#e8e4f4", "D": "#8a8aa8", "y": "#ffd84a"},
      frames: [
        ["................", "...kkkkkkkk.....", "..kyyyyyyyyk....", ".kkkkkkkkkkkk...", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk...", "..kssNNNNNssk...", "...kssssssk.....", "....kkkkkk......", "..kkdddddddkk...", ".kddddyddddddk..", ".kdkdddddddkdk..", ".kskdddddddkskk.", "..kkDDDDDDDkk.k.", "...kDDk.kDDk..k.", "...kDDk.kDDk.kEk", "..kkkkk.kkkkkkEE"],
        ["................", "...kkkkkkkk.....", "..kyyyyyyyyk....", ".kkkkkkkkkkkk...", "..kssssssssk....", "..kskkssskksk...", "..ksssssssssk...", "..kssNNNNNssk...", "...kssssssk.....", "....kkkkkk......", "..kkdddddddkk...", ".kddddyddddddk..", ".kdkdddddddkdk..", ".kskdddddddksk..", "..kkDDDDDDDkkk..", "...kDDk.kDDkk.k.", "...kDDk.kDDk.kEk", "..kkkkk.kkkkknnn"],
      ] },
    jellyfish: { group: 'enemy', note: "W2 Planter/hazard. Bobs in shallows lane. Frames: drift A, drift B, zap (charged, yellow).", frameNames: ["driftA", "driftB", "zap"], pal: {"u": "#ffb8d8", "c": "#c070ff"},
      frames: [
        ["...kkkk...", "..kuuuuk..", ".kucuucuk.", "kuuuuuuuuk", "kuwuuuuuuk", "kkkkkkkkkk", ".u.c.u.c..", ".c.u.c.u..", "..u.c..u..", "..c..u.c.."],
        ["...kkkk...", "..kuuuuk..", ".kucuucuk.", "kuuuuuuuuk", "kuwuuuuuuk", "kkkkkkkkkk", "..u.c.u.c.", "..c.u.c.u.", ".u..c.u...", ".c..u..c.."],
        ["...kkkk...", "..kYYYYk..", ".kYwYYwYk.", "kYYYYYYYYk", "kYwYYYYYYk", "kkkkkkkkkk", "yu.c.u.cy.", ".c.u.c.u..", "y.u.c..uy.", "..c..u.c.."],
      ] },
    atv: { group: 'enemy', note: "W2 Rider. 24x16 Beach Patrol quad with orange-shirt rider. On dismount spawn a normal tourist-cop at the rider position. Frames: wheels A, wheels B.", frameNames: ["rollA", "rollB"], pal: {"d": "#ff9a3a", "D": "#c86a1a"},
      frames: [
        [".........kkkkk..........", "........kdddddk.........", ".......kkkkkkkkk........", "........ksssssk.........", "........kskskk..........", ".........ksssk..........", ".......kkdddddkk........", "......kdddddddddk.......", "...kkkkkkdddkkkkkkkk....", "..krrrrrrkkkkrrrrrrrk...", ".krrrwwwrrrrrrrrrrrrrk..", "kkkkkkkkrrrrrrrkkkkkkkk.", "kekkkekkkkkkkkkkekkkekk.", "keEEEEk..........keEEEEk", "keEkEEk.........keEkEEk.", ".keeek...........keeek.."],
        [".........kkkkk..........", "........kdddddk.........", ".......kkkkkkkkk........", "........ksssssk.........", "........kskskk..........", ".........ksssk..........", ".......kkdddddkk........", "......kdddddddddk.......", "...kkkkkkdddkkkkkkkk....", "..krrrrrrkkkkrrrrrrrk...", ".krrrwwwrrrrrrrrrrrrrk..", "kkkkkkkkrrrrrrrkkkkkkkk.", "kekkkekkkkkkkkkkekkkekk.", "keEEkEk..........keEkEEk", "kekEEEk..........keEEkEk", ".keeek...........keeek.."],
      ] },
    pete_cart: { group: 'boss', note: "MINI 1-3 PARK RANGER PETE, phase 1: on his golf cart (32x24). Frames: drive, drive+horn flash.", frameNames: ["drive", "honk"], pal: {"g": "#5a7a3a", "G": "#3a5028"},
      frames: [
        [".............kkk................", "...........kkTtTkk..............", "..........kttttttttk............", ".......kkkkTTTTTTTTkkkk.........", "..........kssssssssk............", "..........kskkssskksk...........", "..........kssssssssssk..........", "..........kssNNNNNNssk..........", "...kkkkkkkkkksssssskkkkkkkkkk...", "...kwwwwwwwwkkkkkkkkwwwwwwwwk...", "...k.......kgggggggk.......k....", "...k......kgggyggggkk......k....", "...k......kgkgggggkssk.....k....", "...k......kskgggggk..k.....k....", "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..", ".kwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.", "kwwwgggggggwwwwwwwwwwwwwwwwwwwwk", "kwwwggGGggwwwwwwwwwwwwwwwwwwwwwk", "kwwwgggggggwwwwwwwwwwwwwwwwwwwwk", "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk", "..keeek..................keeek..", ".keEEEek................keEEEek.", ".keEkEek................keEkEek.", "..keeek..................keeek.."],
        [".............kkk................", "...........kkTtTkk..............", "..........kttttttttk............", ".......kkkkTTTTTTTTkkkk.........", "..........kssssssssk............", "..........kskkssskksk...........", "..........kssssssssssk..........", "..........kssNNNNNNssk..........", "...kkkkkkkkkksssssskkkkkkkkkk...", "...kwwwwwwwwkkkkkkkkwwwwwwwwk...", "...k.......kgggggggk.......k....", "...k......kgggyggggkk......k..o.", "...k......kgkgggggkssk.....k.oyo", "...k......kskgggggk..k.....k....", "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..", ".kwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.", "kwwwgggggggwwwwwwwwwwwwwwwwwwwwk", "kwwwggGGggwwwwwwwwwwwwwwwwwwwwwk", "kwwwgggggggwwwwwwwwwwwwwwwwwwwwk", "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk", "..keeek..................keeek..", ".keEkEek................keEkEek.", ".keEEEek................keEEEek.", "..keeek..................keeek.."],
      ] },
    pete: { group: 'boss', note: "MINI 1-3 PARK RANGER PETE, phase 2: on foot, ticket book in hand (18x18). Frames: idle, throw.", frameNames: ["idle", "throw"], pal: {"g": "#5a7a3a", "G": "#3a5028"},
      frames: [
        [".......kkk........", ".....kkTtTkk......", "....kttttttttk....", ".kkkkTTTTTTTTkkkk.", "....kssssssssk....", "....kskkssskksk...", "....kssssssssssk..", "....kssNNNNNNssk..", ".....kssssssssk...", "......kkkkkkkk....", "....kkgggggggkk...", "...kgggggyggggk...", "...kgkgggggggkgk..", "...kskgggggggkskww", "....kkGGGGGGGkkkwk", ".....kGGk.kGGk..k.", ".....kGGk.kGGk....", "....kkkkk.kkkkk..."],
        [".......kkk........", ".....kkTtTkk......", "....kttttttttk....", ".kkkkTTTTTTTTkkkk.", "....kssssssssk....", "....kskkssskksk...", "....kssssssssssk..", "....kssNNNNNNssk..", ".....kssssssssk...", "......kkkkkkkk....", "....kkgggggggkkkk.", "...kgggggyggggksk.", "...kgkgggggggk.kwk", "...kskgggggggk.kkk", "....kkGGGGGGGkk...", ".....kGGk.kGGk....", ".....kGGk.kGGk....", "....kkkkk.kkkkk..."],
      ] },
    rangerrick: { group: 'boss', note: "BOSS 1-6 RANGER RICK (24x25). Big beard, campaign hat. Frames: idle, rake sweep (rake held low), spin (arms out - use for the dart-ring signature).", frameNames: ["idle", "rake", "spin"], pal: {"g": "#5a7a3a", "G": "#3a5028", "N": "#8a5024"},
      frames: [
        ["..........kkkk..........", "........kkTttTkk........", ".......kttttttttk.......", "......kttttttttttk......", "..kkkkTTTTTTTTTTTTkkkk..", ".......kssssssssssk.....", ".......kskkkssskkksk....", ".......ksssssssssssk....", ".......kNNNNNNNNNNNk....", ".......kNNNkkkkNNNNk....", "........kNNNNNNNNNk.....", ".........kkkkkkkkk......", ".....kkkgggggggggkkk....", "....kggggggyyggggggggk..", "...kggkggggggggggggkggk.", "...kgkkgggggggggggkkgk..", "...kskkgggggggggggkksk..", "...kssk.kkkkkkkkkk.kssk.", "....kk..kGGGGGGGGk..kk..", "........kGGGGGGGGk......", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", ".......kkNNNk.kNNNkk....", "......kkkkkkk.kkkkkkk..."],
        ["..........kkkk..........", "........kkTttTkk........", ".......kttttttttk.......", "......kttttttttttk......", "..kkkkTTTTTTTTTTTTkkkk..", ".......kssssssssssk.....", ".......kskkkssskkksk....", ".......ksssssssssssk....", ".......kNNNNNNNNNNNk....", ".......kNNNkkkkNNNNk....", "........kNNNNNNNNNk.....", ".........kkkkkkkkk......", ".....kkkgggggggggkkk....", "....kggggggyyggggggggk.k", "...kggkggggggggggggkkskN", "...kgkkggggggggggggkk.N.", "...kskkgggggggggggk..N.k", "...kssk.kkkkkkkkkk..NkNk", "....kk..kGGGGGGGGk.NkNkN", "........kGGGGGGGGk......", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", ".......kkNNNk.kNNNkk....", "......kkkkkkk.kkkkkkk..."],
        ["..........kkkk..........", "........kkTttTkk........", ".......kttttttttk.......", "......kttttttttttk......", "..kkkkTTTTTTTTTTTTkkkk..", ".......kssssssssssk.....", ".......kskkkssskkksk....", ".......ksssssssssssk....", ".......kNNNNNNNNNNNk....", ".......kNNNkkkkNNNNk....", "........kNNNNNNNNNk.....", ".........kkkkkkkkk......", "kkkkkkkgggggggggkkkkkkkk", "Nsskgggggyyggggggggkssk.", ".kk.kggggggggggggggk.kk.", "...kgggggggggggggggk....", "...kgggggggggggggggk....", "....kkkkkkkkkkkkkkk.....", "....kk..kGGGGGGGGk..kk..", "........kGGGGGGGGk......", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", "........kGGGk.kGGGk.....", ".......kkNNNk.kNNNkk....", "......kkkkkkk.kkkkkkk..."],
      ] },
    rangerrick_atv: { group: 'boss', note: "BOSS 1-6 RANGER RICK rage phase on a green ranger ATV (24x16). Frames: rollA, rollB.", frameNames: ["rollA", "rollB"], pal: {"g": "#5a7a3a", "G": "#3a5028", "N": "#8a5024", "d": "#5a7a3a"},
      frames: [
        ["........kkkkkk..........", "......kkTttTtkk.........", ".....kkTTTTTTTTkk.......", "........ksssssk.........", "........kNNNNNk.........", ".........kNNNk..........", ".......kkgggggkk........", "......kggggggggk........", "...kkkkkkdddkkkkkkkk....", "..kgggggkkkkkggggggk....", ".kgggwwwggggggggggggk...", "kkkkkkkkgggggggkkkkkkkk.", "kekkkekkkkkkkkkkekkkekk.", "keEEEEk..........keEEEEk", "keEkEEk.........keEkEEk.", ".keeek...........keeek.."],
        ["........kkkkkk..........", "......kkTttTtkk.........", ".....kkTTTTTTTTkk.......", "........ksssssk.........", "........kNNNNNk.........", ".........kNNNk..........", ".......kkgggggkk........", "......kggggggggk........", "...kkkkkkdddkkkkkkkk....", "..kgggggkkkkkggggggk....", ".kgggwwwggggggggggggk...", "kkkkkkkkgggggggkkkkkkkk.", "kekkkekkkkkkkkkkekkkekk.", "keEEkEk..........keEkEEk", "kekEEEk..........keEEkEk", ".keeek...........keeek.."],
      ] },
    barb: { group: 'boss', note: "MINI 2-4 BEACH PATROL BARB (22x20). Blonde, shades, red patrol suit. Frames: idle, megaphone blast, buoy kick.", frameNames: ["idle", "megaphone", "kick"], pal: {"h": "#f0d060", "v": "#2a1838"},
      frames: [
        [".......kkkkkkk........", ".....kkhhhhhhhkk......", "....khhhhhhhhhhhk.....", "....khhkkkkkkkhhk.....", "....khkvvvkvvvkhk.....", "....khkssssssskhk.....", "....khsssssssssk......", ".....kssrrrrrssk......", "......kssssssk........", ".......kkkkkk.........", ".....kkrrrrrrkk.......", "....krrrrwwrrrrk......", "...krrkrrwwrrkrrk.....", "...kskrrrrrrrrkssk....", "...kskrrrrrrrrkkk.....", "....kkRRRRRRRRk.......", "......kssk.kssk.......", "......kssk.kssk.......", "......kssk.kssk.......", ".....kkkkk.kkkkk......"],
        [".......kkkkkkk........", ".....kkhhhhhhhkk......", "....khhhhhhhhhhhk.....", "....khhkkkkkkkhhk.....", "....khkvvvkvvvkhk.....", "....khkssssssskhk.....", "....khsssssssssk......", ".....kssrrrrrssk......", "......kssssssk........", ".......kkkkkk.........", ".....kkrrrrrrkk..kk...", "....krrrrwwrrrrkkwwk..", "...krrkrrwwrrkkkwwwwk.", "...kskrrrrrrrrkssswwwk", "...kskrrrrrrrrk.kkwwk.", "....kkRRRRRRRRk...kk..", "......kssk.kssk.......", "......kssk.kssk.......", "......kssk.kssk.......", ".....kkkkk.kkkkk......"],
        [".......kkkkkkk........", ".....kkhhhhhhhkk......", "....khhhhhhhhhhhk.....", "....khhkkkkkkkhhk.....", "....khkvvvkvvvkhk.....", "....khkssssssskhk.....", "....khsssssssssk......", ".....kssrrrrrssk......", "......kssssssk........", ".......kkkkkk.........", ".....kkrrrrrrkk.......", "....krrrrwwrrrrk......", "...krrkrrwwrrkrrk.....", "...kskrrrrrrrrkssk....", "...kskrrrrrrrrkkk.....", "....kkRRRRRRRRk.......", "......kssk.ksssk......", "......kssk..ksssk.....", "......kssk...kssk.....", ".....kkkkk....kkkk...."],
      ] },
    lance: { group: 'boss', note: "BOSS 2-7 LIFEGUARD LANCE (22x21). Shirtless, bleached hair, shades, red trunks. Frames: idle, lasso throw (rescue tube), spin (taser-ring signature).", frameNames: ["idle", "lasso", "spin"], pal: {"s": "#e8a868", "S": "#b87a48", "y": "#fff0b0"},
      frames: [
        ["........kkkkkk........", "......kkyyyyyykk......", ".....kyyyyyyyyyyk.....", ".....kyykkkkkkyyk.....", ".....kykvvvkvvvkk.....", ".....kksssssssssk.....", "......ksssssssssk.....", "......kssswwwwssk.....", ".......kssssssk.......", ".....kkkkkkkkkkkk.....", "...kksssssssssssskk...", "..kssssswssssswsssk...", "..ksskssssssssssksk...", "..kssksSSssssSSkssk...", "..kssk.kkkkkkkk.kssk..", "...kk..krrrrrrk..kk...", ".......krrrwrrk.......", ".......kssk.kssk......", ".......kssk.kssk......", ".......kssk.kssk......", "......kkkkk.kkkkk....."],
        ["........kkkkkk........", "......kkyyyyyykk......", ".....kyyyyyyyyyyk.....", ".....kyykkkkkkyyk.....", ".....kykvvvkvvvkk.....", ".....kksssssssssk.....", "......ksssssssssk.....", "......kssswwwwssk.....", ".......kssssssk.......", ".....kkkkkkkkkkkk.....", "...kksssssssssssskkkkk", "..kssssswssssswssskrrk", "..ksskssssssssssk.krrk", "..kssksSSssssSSk..kk..", "..kssk.kkkkkkkk.kssk..", "...kk..krrrrrrk..kk...", ".......krrrwrrk.......", ".......kssk.kssk......", ".......kssk.kssk......", ".......kssk.kssk......", "......kkkkk.kkkkk....."],
        ["........kkkkkk........", "......kkyyyyyykk......", ".....kyyyyyyyyyyk.....", ".....kyykkkkkkyyk.....", ".....kykvvvkvvvkk.....", ".....kksssssssssk.....", "......ksssssssssk.....", "......kssswwwwssk.....", ".......kssssssk.......", ".....kkkkkkkkkkkk.....", "kkkkkssssssssssssskkkk", "kssssssswssssswsssssk.", ".kkkkssssssssssskkkk..", ".....kSSssssSSk.......", "..kssk.kkkkkkkk.kssk..", "...kk..krrrrrrk..kk...", ".......krrrwrrk.......", ".......kssk.kssk......", ".......kssk.kssk......", ".......kssk.kssk......", "......kkkkk.kkkkk....."],
      ] },
    lance_board: { group: 'prop', note: "Lance surfboard (26x6) - drawn under Lance during surf-dash and the tidal-wave rage phase.", frameNames: ["board"], pal: {},
      frames: [
        ["......................kk..", ".................kkkkkkyk.", "..kkkkkkkkkkkkkkkyyyyyyyk.", ".kyyyyyyyyrrryyyyyyyyyyk..", "kyyyyyyyyyrrryyyyyyyyykk..", ".kkkkkkkkkkkkkkkkkkkkk...."],
      ] },
    ticketbook: { group: 'proj', note: "Pete ticket-book shot (6x5). Spin by alternating frames.", frameNames: ["a", "b"], pal: {},
      frames: [
        ["kkkkkk", "kwwwwk", "kwrrwk", "kwwwwk", "kkkkkk"],
        [".kkkk.", "kwwwwk", "kwrrwk", "kwwwwk", ".kkkk."],
      ] },
    buoy: { group: 'proj', note: "Barb rolling buoy (8x7). Alternate frames while rolling.", frameNames: ["a", "b"], pal: {},
      frames: [
        ["..kkkk..", ".krrwwk.", "krrwwrrk", "kwwrrwwk", "krrwwrrk", ".kwwrrk.", "..kkkk.."],
        ["..kkkk..", ".kwwrrk.", "kwwrrwwk", "krrwwrrk", "kwwrrwwk", ".krrwwk.", "..kkkk.."],
      ] },
    beartrap: { group: 'prop', note: "Rick bear trap (11x5). Frames: open (armed), snapped.", frameNames: ["open", "snapped"], pal: {},
      frames: [
        ["k.k.k.k.k.k", "kEkEkEkEkEk", "kkkkkkkkkkk", "keeeeeeeeek", "kkkkkkkkkkk"],
        ["...........", ".kkkkkkkkk.", "kEkEkEkEkEk", "keeeeeeeeek", "kkkkkkkkkkk"],
      ] },
    rescuetube: { group: 'proj', note: "Lance lasso head (8x6). Draw a 1px rope line from Lance hand to it.", frameNames: ["tube"], pal: {},
      frames: [
        [".kkkkkk.", "krrrrrrk", "krk..krk", "krk..krk", "krrrrrrk", ".kkkkkk."],
      ] },
    junk: { group: 'proj', note: "Metal Detector junk throws (6x4): can, bottle cap, coin-ish. Pick a random frame per shot.", frameNames: ["can", "cap", "gold"], pal: {},
      frames: [
        [".kkkk.", "kEEEEk", "kEeeEk", ".kkkk."],
        ["..kk..", ".krrk.", "krrrrk", ".kkkk."],
        [".kkk..", "kyyyk.", "kyYyk.", ".kkk.."],
      ] },
    frisbee: { group: 'proj', note: "Frisbee wild-weapon projectile (8x4). Alternate frames for spin.", frameNames: ["a", "b"], pal: {},
      frames: [
        ["..kkkk..", ".kccccck", "kcwcccck", ".kkkkkk."],
        ["........", ".kkkkkk.", "kcccccck", ".kkkkkk."],
      ] },
    waterblast: { group: 'proj', note: "Super Soaker blob (6x5): flying, splash.", frameNames: ["fly", "splash"], pal: {},
      frames: [
        ["..vv..", ".vwwv.", "vwwwwv", ".vwwv.", "..vv.."],
        [".v..v.", "v.vv.v", ".vwwv.", "v.vv.v", ".v..v."],
      ] },
    wildrack: { group: 'prop', note: "Weapon rack (14x9) - the once-per-level Wild pickup spot from brief A3. Draw the rolled weapon icon over it.", frameNames: ["rack"], pal: {},
      frames: [
        ["kkkkkkkkkkkkkk", "kNNNNNNNNNNNNk", "k.k..k..k..k.k", "k.E..y..r..v.k", "k.E..y..r..v.k", "k.E..y..r..v.k", "kNNNNNNNNNNNNk", "kk..........kk", "kk..........kk"],
      ] },
    icon_bonghammer: { group: 'icon', note: "Wild HUD/bag icon for bonghammer", frameNames: ["icon"], pal: {},
      frames: [
        ["...kkk....", "..kvvvk...", "..kvGvk...", ".kkvvvkk..", ".kEkkkEk..", "...kEk....", "...kNk....", "...kNk....", "...kNk....", "...kkk...."],
      ] },
    icon_bluntbat: { group: 'icon', note: "Wild HUD/bag icon for bluntbat", frameNames: ["icon"], pal: {},
      frames: [
        [".......kk.", "......kook", ".....kttyk", "....kttTk.", "...kttTk..", "..kttTk...", ".kttTk....", "kNNk......", "kkk.......", ".........."],
      ] },
    icon_rollingpapers: { group: 'icon', note: "Wild HUD/bag icon for rollingpapers", frameNames: ["icon"], pal: {},
      frames: [
        ["....k.....", "...kwk....", ".kkwWwkk..", "kwwWwWwwk.", ".kkwWwkk..", "...kwk....", "....k.....", "..........", "..........", ".........."],
      ] },
    icon_applepipe: { group: 'icon', note: "Wild HUD/bag icon for applepipe", frameNames: ["icon"], pal: {},
      frames: [
        ["....kk....", "....kN....", "..kkkkkk..", ".krrrrrrk.", "krrrrkkrk.", "krRrrrrrk.", "krRrrrrrk.", ".krRRrrk..", "..kkkkk...", ".........."],
      ] },
    icon_nugbombs: { group: 'icon', note: "Wild HUD/bag icon for nugbombs", frameNames: ["icon"], pal: {},
      frames: [
        ["......kk..", ".....kyk..", "....kk....", "..kkGGkk..", ".kGgGGgGk.", "kGgGgGGgGk", "kGGpGgGpGk", ".kGgGGgGk.", "..kkkkkk..", ".........."],
      ] },
    icon_hackysack: { group: 'icon', note: "Wild HUD/bag icon for hackysack", frameNames: ["icon"], pal: {},
      frames: [
        ["..kkkkk...", ".kryrgyk..", "kyrgyrgyk.", "krgyrgyrk.", "kgyrgyrgk.", ".kyrgyrk..", "..kkkkk...", "..........", "..........", ".........."],
      ] },
    icon_frisbee: { group: 'icon', note: "Wild HUD/bag icon for frisbee", frameNames: ["icon"], pal: {},
      frames: [
        ["..........", "..kkkkkk..", ".kcccccck.", "kcwcccccck", "kcccccccck", ".kkkkkkkk.", "..........", "..........", "..........", ".........."],
      ] },
    icon_kite: { group: 'icon', note: "Wild HUD/bag icon for kite", frameNames: ["icon"], pal: {},
      frames: [
        ["....k.....", "...krk....", "..kryrk...", ".kryyyrk..", "kryyyyyrk.", ".krgggrk..", "..krgrk...", "...kgk....", "....k.c...", ".....c.c.."],
      ] },
    icon_supersoaker: { group: 'icon', note: "Wild HUD/bag icon for supersoaker", frameNames: ["icon"], pal: {},
      frames: [
        ["..........", ".kkkkkkk..", "kvvvvvvvkk", "kvwvvvvvvk", "kkkkodkkkk", "...kodk...", "...kddk...", "...kkkk...", "..........", ".........."],
      ] },
    icon_umbrella: { group: 'icon', note: "Wild HUD/bag icon for umbrella", frameNames: ["icon"], pal: {},
      frames: [
        ["....kk....", "..kkrrkk..", ".krrwwrrk.", "krwwrrwwrk", "kkkkkkkkkk", "....kN....", "....kN....", "....kN....", "..kNNk....", "..kkk....."],
      ] },
    icon_trashlid: { group: 'icon', note: "Wild HUD/bag icon for trashlid", frameNames: ["icon"], pal: {},
      frames: [
        ["...kkkk...", "..kkEEkk..", ".kEEmmEEk.", "kEmmmmmmEk", "kEmmWWmmEk", "kEmmmmmmEk", ".kEEmmEEk.", "..kkkkkk..", "..........", ".........."],
      ] },
    icon_surfboard: { group: 'icon', note: "Wild HUD/bag icon for surfboard", frameNames: ["icon"], pal: {},
      frames: [
        [".......kk.", "......kyyk", ".....kyrk.", "....kyrk..", "...kyrk...", "..kyrk....", ".kyyk.....", "kyyk......", "kkk.......", ".........."],
      ] },
    held_frisbee: { group: 'held', note: "Held sprite for NEW Wild weapon frisbee", frameNames: ["held"], pal: {},
      frames: [
        ["..kkkkkk..", ".kccccccck", "kcwccccccc", ".kkkkkkkk."],
      ] },
    held_kite: { group: 'held', note: "Held sprite for NEW Wild weapon kite", frameNames: ["held"], pal: {},
      frames: [
        ["......k.....", ".....krk....", "....kryrk...", "...kryyyrk..", "..kryyyyyrk.", "...krgggrk..", "....krgrk...", ".....kgk....", "....w.k.....", "...w........", "..w.........", ".w.........."],
      ] },
    held_supersoaker: { group: 'held', note: "Held sprite for NEW Wild weapon supersoaker", frameNames: ["held"], pal: {},
      frames: [
        ["..kkkkkkkkkk....", ".kvvvvvvvvvvkkk.", "kvwvvvvvvvvvvvvk", "kkkkkodkkkkkkkk.", "....kodk........", "....kddk........", "....kkkk........"],
      ] },
    held_umbrella: { group: 'held', note: "Held sprite for NEW Wild weapon umbrella", frameNames: ["held"], pal: {},
      frames: [
        [".....kkkkkk.....", "...kkrrwwrrkk...", "..krrwwrrwwrrk..", ".krwwrrwwrrwwrk.", "kkkkkkkkkkkkkkkk", ".......kN.......", ".......kN.......", ".......kN.......", ".......kN.......", ".....kNNk.......", ".....kkk........"],
      ] },
  },
  // build(sprite, P): returns { id: [canvas, ...] } using game.js's own sprite() so colours match exactly.
  build(sprite, P) { const o = {}; for (const id in this.assets) { const a = this.assets[id]; o[id] = a.frames.map(f => sprite(f, { ...P, ...a.pal })); } return o; },
};
