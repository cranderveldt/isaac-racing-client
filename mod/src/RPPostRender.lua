local RPPostRender = {}

--
-- Includes
--

local RPGlobals    = require("src/rpglobals")
local RPSaveDat    = require("src/rpsavedat")
local RPSprites    = require("src/rpsprites")
local RPSchoolbag  = require("src/rpschoolbag")
local RPSoulJar    = require("src/rpsouljar")
local RPPostUpdate = require("src/rppostupdate")
local RPItems      = require("src/rpitems")
local RPFastTravel = require("src/rpfasttravel")
local RPTimer      = require("src/rptimer")
local RPSpeedrun   = require("src/rpspeedrun")

--
-- PostRender functions
--

-- Check various things once per draw frame (60 times a second)
-- (this will fire while the floor/room is loading)
-- ModCallbacks.MC_POST_RENDER (2)
function RPPostRender:Main()
  -- Local variables
  local game = Game()
  local player = game:GetPlayer(0)

  -- Read the "save.dat" file and do nothing else on this frame if reading failed
  RPSaveDat:Load()

  -- Keep track of whether the race is finished or not
  -- (we need to check for "open" because it is possible to quit at the main menu and
  -- then join another race before starting the game)
  if RPGlobals.race.status == "none" or RPGlobals.race.status == "open" then
    RPGlobals.raceVars.started = false
  end

  -- Restart the game if Easter Egg or race or speedrun validation failed
  RPPostRender:CheckRestart()

  -- Reseed the floor if we have Duality and there is a narrow boss room
  RPPostRender:CheckDualityNarrowRoom()

  -- Reseed the floor if we are playing on a seeded MO ruleset there is a narrow Treasure Room
  RPPostRender:CheckSeededMONarrowRoom()

  -- Draw graphics
  RPSprites:Display()
  RPFastTravel:SpriteDisplay()
  RPSchoolbag:SpriteDisplay()
  RPSoulJar:SpriteDisplay()
  RPTimer:Display()
  RPSpeedrun:DisplayCharProgress()
  RPSpeedrun:DisplayCharSelectRoom()

  -- Ban Basement 1 Treasure Rooms
  RPPostUpdate:CheckBanB1TreasureRoom()

  -- Make Cursed Eye seeded
  RPPostRender:CheckCursedEye()

  -- Stop the animation after using Telepills or Blank Card
  -- (this has to be in the PostRender callback because game frames do not tick when the use animation is happening)
  if RPGlobals.run.usedTelepills then
    RPGlobals.run.usedTelepills = false
    player:StopExtraAnimation()
  end

  -- Check for trapdoor related things
  RPFastTravel:CheckTrapdoor()

  -- Check for reset inputs
  RPPostRender:CheckResetInput()

  -- Check to see if we are subverting a teleport from Gurdy, Mom's Heart, or It Lives
  RPPostRender:CheckSubvertTeleport()

  -- Do race specific stuff
  RPPostRender:Race()

  -- Do speedrun related checks
  RPSpeedrun:CheckRestart()
  RPSpeedrun:CheckChangeCharOrder()
end

-- Restart the game if Easter Egg or race or speedrun validation failed
-- (we can't do this in the "PostGameStarted" callback because
-- the "restart" command will fail when the game is first loading)
function RPPostRender:CheckRestart()
  -- Local variables
  local game = Game()
  local seeds = game:GetSeeds()
  local runSeed = seeds:GetStartSeedString()
  local challenge = Isaac.GetChallenge()
  local isaacFrameCount = Isaac.GetFrameCount()

  if RPGlobals.run.restartFrame ~= 0 and isaacFrameCount >= RPGlobals.run.restartFrame then
    RPGlobals.run.restartFrame = 0

    -- Change the seed of the run if need be
    if runSeed ~= RPGlobals.race.seed and
       RPGlobals.race.rFormat == "seeded" and
       RPGlobals.race.status == "in progress" then

      -- Change the seed of the run and restart the game
      local command = "seed " .. RPGlobals.race.seed
      Isaac.ExecuteCommand(command)
      Isaac.DebugString("Issued a \"" .. command .. "\" command.")
      -- (we can perform another restart immediately afterwards to change the character and nothing will go wrong)
    end

    -- The "restart" command takes an optional argument to specify the character; we might want to specify this
    local command = "restart"
    if challenge == Isaac.GetChallengeIdByName("R+9 Speedrun (S1)") then
      command = command .. " " .. RPGlobals.race.order9[RPSpeedrun.charNum]
    elseif challenge == Isaac.GetChallengeIdByName("R+9/14 Speedrun (S1)") then
      command = command .. " " .. RPGlobals.race.order14[RPSpeedrun.charNum]
    elseif RPGlobals.race.status ~= "none" then
      command = command .. " " .. RPGlobals.race.character
    end
    Isaac.ExecuteCommand(command)
    Isaac.DebugString("Issued a \"" .. command .. "\" command.")
    return
  end
end

-- Reseed the floor if we have Duality and there is a narrow boss room
function RPPostRender:CheckDualityNarrowRoom()
  -- Local variables
  local game = Game()
  local level = game:GetLevel()
  local rooms = level:GetRooms()
  local room = game:GetRoom()
  local isaacFrameCount = Isaac.GetFrameCount()

  if RPGlobals.run.dualityCheckFrame ~= 0 and isaacFrameCount >= RPGlobals.run.dualityCheckFrame then
    RPGlobals.run.dualityCheckFrame = 0

    -- Check to see if the boss room is narrow
    for i = 0, rooms.Size - 1 do -- This is 0 indexed
      local roomData = rooms:Get(i).Data
      if roomData.Type == RoomType.ROOM_BOSS then -- 5
        if roomData.Shape == RoomShape.ROOMSHAPE_IH or -- 2
           roomData.Shape == RoomShape.ROOMSHAPE_IV then -- 3

          local command = "reseed"
          Isaac.ExecuteCommand(command)
          Isaac.DebugString("Executed command: " .. command .. " (narrow boss room detected with Duality)")

          -- Respawn the hole
          game:Spawn(Isaac.GetEntityTypeByName("Pitfall (Custom)"), Isaac.GetEntityVariantByName("Pitfall (Custom)"),
                     room:GetCenterPos(), Vector(0,0), nil, 0, 0)

          -- Mark to check for a narrow room again on the next frame, just in case
          RPGlobals.run.dualityCheckFrame = isaacFrameCount + 1
        end
        break
      end
    end
  end
end

-- Reseed the floor if we have a narrow Treasure Room on a seeded MO ruleset
function RPPostRender:CheckSeededMONarrowRoom()
  -- Local variables
  local game = Game()
  local level = game:GetLevel()
  local stage = level:GetStage()
  local rooms = level:GetRooms()
  local room = game:GetRoom()
  local isaacFrameCount = Isaac.GetFrameCount()

  if RPGlobals.run.seededMOCheckFrame ~= 0 and isaacFrameCount >= RPGlobals.run.seededMOCheckFrame then
    RPGlobals.run.seededMOCheckFrame = 0

    -- Check to see if the boss room is narrow
    for i = 0, rooms.Size - 1 do -- This is 0 indexed
      local roomData = rooms:Get(i).Data
      if roomData.Type == RoomType.ROOM_TREASURE then -- 4
        if roomData.Shape == RoomShape.ROOMSHAPE_IH or -- 2
           roomData.Shape == RoomShape.ROOMSHAPE_IV then -- 3

          local command = "reseed"
          Isaac.ExecuteCommand(command)
          Isaac.DebugString("Executed command: " .. command .. " (narrow Treasure Room detected with seeded MO)")

          -- Respawn the hole
          if stage ~= 1 then
            game:Spawn(Isaac.GetEntityTypeByName("Pitfall (Custom)"), Isaac.GetEntityVariantByName("Pitfall (Custom)"),
                       room:GetCenterPos(), Vector(0,0), nil, 0, 0)
          end

          -- Mark to check for a narrow room again on the next frame, just in case
          RPGlobals.run.seededMOCheckFrame = isaacFrameCount + 1
        end
        break
      end
    end
  end
end

-- Make Cursed Eye seeded
-- (this has to be in the PostRender callback because game frames do not tick when
-- the teleport animation is happening)
function RPPostRender:CheckCursedEye()
  -- Local variables
  local game = Game()
  local player = game:GetPlayer(0)
  local playerSprite = player:GetSprite()
  local hearts = player:GetHearts()
  local soulHearts = player:GetSoulHearts()

  if player:HasCollectible(CollectibleType.COLLECTIBLE_CURSED_EYE) and -- 316
     playerSprite:IsPlaying("TeleportUp") and
     RPGlobals.run.naturalTeleport == false then -- Only catch Cursed Eye teleports

    -- Account for the Cursed Skull trinket
    if player:HasTrinket(TrinketType.TRINKET_CURSED_SKULL) and -- 43
       ((hearts == 1 and soulHearts == 0) or
        (hearts == 0 and soulHearts == 1)) then -- 1/2 of a heart remaining

      Isaac.DebugString("Cursed Skull teleport detected.")
    else
      -- Account for Devil Room teleports from Red Chests
      local touchingRedChest = false
      for i, entity in pairs(Isaac.GetRoomEntities()) do
        if entity.Type == EntityType.ENTITY_PICKUP and -- 5
           entity.Variant == PickupVariant.PICKUP_REDCHEST and -- 360
           entity.SubType == 0 and -- A subtype of 0 indicates that it is opened, a 1 indicates that it is unopened
           player.Position.X >= entity.Position.X - 24 and -- 25 is a touch too big
           player.Position.X <= entity.Position.X + 24 and
           player.Position.Y >= entity.Position.Y - 24 and
           player.Position.Y <= entity.Position.Y + 24 then

          touchingRedChest = true
        end
      end
      if touchingRedChest then
        Isaac.DebugString("Red Chest teleport detected.")
      else
        Isaac.DebugString("Cursed Eye teleport detected.")
        RPItems:Teleport()
      end
    end
  end
end

-- Check for reset inputs
function RPPostRender:CheckResetInput()
  -- Local variables
  local game = Game()
  local level = game:GetLevel()
  local stage = level:GetStage()
  local isaacFrameCount = Isaac.GetFrameCount()
  local challenge = Isaac.GetChallenge()

  -- Check to see if we are opening the console window
  -- (ignore challenges in case someone accdiently pushes grave in the middle of their speedrun)
  if Input.IsButtonTriggered(Keyboard.KEY_GRAVE_ACCENT, 0) and -- 96
     challenge == Challenge.CHALLENGE_NULL then -- 0

    RPGlobals.run.consoleWindowOpen = true
    return
  end

  -- Don't fast-reset if any modifiers are pressed
  -- (with the exception of shift, since MasterofPotato uses shift)
  if Input.IsButtonPressed(Keyboard.KEY_LEFT_CONTROL, 0) or -- 341
     Input.IsButtonPressed(Keyboard.KEY_LEFT_ALT, 0) or -- 342
     Input.IsButtonPressed(Keyboard.KEY_LEFT_SUPER, 0) or -- 343
     Input.IsButtonPressed(Keyboard.KEY_RIGHT_CONTROL, 0) or -- 345
     Input.IsButtonPressed(Keyboard.KEY_RIGHT_ALT, 0) or -- 346
     Input.IsButtonPressed(Keyboard.KEY_RIGHT_SUPER, 0) then -- 347

    return
  end

  -- Check for the "R" input
  local resetPressed = false
  for i = 0, 3 do -- There are 4 possible inputs/players from 0 to 3
    -- (we check all inputs instead of "player.ControllerIndex" because
    -- a controller player might be using the keyboard to reset)
    if Input.IsActionTriggered(ButtonAction.ACTION_RESTART, i) then -- 16
      resetPressed = true
      break
    end
  end
  if resetPressed == false then
    return
  end

  if (stage == 1 and RPGlobals.run.consoleWindowOpen == false) or
     isaacFrameCount <= RPGlobals.run.fastResetFrame + 60 then

    RPSpeedrun.fastReset = true
    -- A fast reset means to reset the current character, a slow/normal reset means to go back to the first character
    local command = "restart"
    Isaac.ExecuteCommand(command)
    Isaac.DebugString("Executed command: " .. command)
  else
    -- To fast reset on floors 2 and beyond, we need to double tap R
    -- (or if we brought the console window up this run)
    RPGlobals.run.fastResetFrame = isaacFrameCount
    Isaac.DebugString("Set fast-reset frame to: " .. tostring(RPGlobals.run.fastResetFrame))
  end
end

-- Check to see if we are subverting a teleport from Gurdy, Mom's Heart, or It Lives
function RPPostRender:CheckSubvertTeleport()
  -- Local variables
  local game = Game()
  local level = game:GetLevel()
  local player = game:GetPlayer(0)

  if RPGlobals.run.teleportSubverted then
    RPGlobals.run.teleportSubverted = false
    player.SpriteScale = RPGlobals.run.teleportSubvertScale

    -- Find the correct position to teleport to, depending on which door we entered from
    local pos
    if level.EnterDoor == Direction.LEFT then -- 0
      pos = Vector(80, 280) -- (the default position if you enter the room from the left door)
    elseif level.EnterDoor == Direction.UP then -- 1
      pos = Vector(320, 160) -- (the default position if you enter the room from the top door)
    elseif level.EnterDoor == Direction.RIGHT then -- 2
      pos = Vector(560, 280) -- (the default position if you enter the room from the right door)
    elseif level.EnterDoor == Direction.DOWN then -- 3
      pos = Vector(320, 400) -- (the default position if you enter the room from the bottom door)
    end

    -- Teleport them
    player.Position = pos
  end
end

-- Do race specific stuff
function RPPostRender:Race()
  -- Local variables
  local game = Game()
  local level = game:GetLevel()
  local roomIndex = level:GetCurrentRoomDesc().SafeGridIndex
  if roomIndex < 0 then -- SafeGridIndex is always -1 for rooms outside the grid
    roomIndex = level:GetCurrentRoomIndex()
  end
  local player = game:GetPlayer(0)

  -- If we are not in a race, do nothing
  if RPGlobals.race.status == "none" then
    -- Remove graphics as soon as the race is over
    RPSprites:Init("top", 0)
    RPSprites:ClearStartingRoomGraphicsTop()
    RPSprites:ClearStartingRoomGraphicsBottom()
    RPSprites:ClearPostRaceStartGraphics()
    if RPGlobals.raceVars.finished == false then
      RPSprites:Init("place", 0) -- Keep the place there at the end of a race
    end
    return
  end

  --
  -- Race validation stuff
  --

  -- Show warning messages
  if RPGlobals.raceVars.difficulty ~= 0 and
     RPGlobals.raceVars.startedTime == 0 then

    -- Check to see if we are on hard mode
    RPSprites:Init("top", "error-hard-mode") -- Error: You are on hard mode.
    return

  elseif RPGlobals.raceVars.challenge ~= 0 and
         RPGlobals.raceVars.startedTime == 0 then

    -- Check to see if we are on a challenge
    RPSprites:Init("top", "error-challenge") -- Error: You are on a challenge.
    return

  elseif RPSprites.sprites.top ~= nil and
         (RPSprites.sprites.top.spriteName == "error-hard-mode" or
          RPSprites.sprites.top.spriteName == "error-challenge") then

    RPSprites:Init("top", 0)
  end

  --
  -- Grahpics for the "Race Start" room
  --

  -- Show the graphics for the "Race Start" room (the top half)
  if RPGlobals.race.status == "open" and
     roomIndex == GridRooms.ROOM_DEBUG_IDX then -- -3

    RPSprites:Init("top", "wait") -- "Wait for the race to begin!"
    RPSprites:Init("myStatus", RPGlobals.race.myStatus)
    RPSprites:Init("ready", tostring(RPGlobals.race.placeMid))
    -- We use "placeMid" to hold this variable, since it isn't used before a race starts
    RPSprites:Init("slash", "slash")
    RPSprites:Init("readyTotal", tostring(RPGlobals.race.numEntrants))
  else
    if RPSprites.sprites.top ~= nil and RPSprites.sprites.top.spriteName == "wait" then
      -- There can be other things on the "top" sprite location and we don't want to have to reload it on every frame
      RPSprites:Init("top", 0)
    end
    RPSprites:ClearStartingRoomGraphicsTop()
  end

  -- Show the graphics for the "Race Start" room (the bottom half)
  if (RPGlobals.race.status == "open" or RPGlobals.race.status == "starting") and
     roomIndex == GridRooms.ROOM_DEBUG_IDX then -- -3

    RPSprites:Init("raceType", RPGlobals.race.rType)
    RPSprites:Init("raceTypeIcon", RPGlobals.race.rType .. "Icon")
    RPSprites:Init("raceFormat", RPGlobals.race.rFormat)
    RPSprites:Init("raceFormatIcon", RPGlobals.race.rFormat .. "Icon")
    RPSprites:Init("goal", "goal")
    RPSprites:Init("raceGoal", RPGlobals.race.goal)
  else
    RPSprites:ClearStartingRoomGraphicsBottom()
  end

  --
  -- Countdown graphics
  --

  -- Show the appropriate countdown graphic/text
  if RPGlobals.race.status == "starting" then
    if RPGlobals.race.countdown == 10 then
      RPSprites:Init("top", "10")

    elseif RPGlobals.race.countdown == 5 then
      RPSprites:Init("top", "5")

    elseif RPGlobals.race.countdown == 4 then
      RPSprites:Init("top", "4")

    elseif RPGlobals.race.countdown == 3 then
      RPSprites:Init("top", "3")

    elseif RPGlobals.race.countdown == 2 then
      RPSprites:Init("top", "2")

      -- Disable resetting to prevent the user from resetting at the same time that we do later on
      RPGlobals.raceVars.resetEnabled = false

    elseif RPGlobals.race.countdown == 1 then
      RPSprites:Init("top", "1")
    end
  end

  --
  -- Race active
  --

  if RPGlobals.race.status == "in progress" then
    -- The client will set countdown equal to 0 and the status equal to "in progress" at the same time
    if RPGlobals.raceVars.started == false then
      -- Reset some race-related variables
      RPGlobals.raceVars.started = true
      RPGlobals.raceVars.resetEnabled = true -- Re-enable holding R to reset
      RPGlobals.raceVars.showPlaceGraphic = false
      -- We don't want to show the place graphic until we get to the 2nd floor
      RPGlobals.raceVars.startedTime = Isaac.GetTime() -- Mark when the race started
      Isaac.DebugString("Starting the race! (" .. tostring(RPGlobals.race.rFormat) .. ")")
    end

    -- Find out how much time has passed since the race started
    local elapsedTime = (Isaac.GetTime() - RPGlobals.raceVars.startedTime) / 1000
    -- "Isaac.GetTime()" is analogous to Lua's "os.clock()"
    -- This will be in milliseconds, so we divide by 1000 to get seconds

    -- Draw the "Go!" graphic
    if elapsedTime < 3 then
      RPSprites:Init("top", "go")
    else
      RPSprites:Init("top", 0)
    end

    -- Draw the graphic that shows what place we are in
    if RPGlobals.raceVars.showPlaceGraphic and -- Don't show it on the first floor
       RPGlobals.race.solo == false then -- Its irrelevant to show "1st" when there is only one person in the race

      RPSprites:Init("place", tostring(RPGlobals.race.placeMid))
    else
      RPSprites:Init("place", 0)
    end
  end

  -- Remove graphics as soon as we enter another room
  -- (this is done separately from the above if block in case the client and mod become desynchronized)
  if RPGlobals.raceVars.started == true and RPGlobals.run.roomsEntered > 1 then
    RPSprites:ClearPostRaceStartGraphics()
  end

  -- Hold the player in place when in the Race Room (to emulate the Gaping Maws effect)
  -- (this looks glitchy and jittery if is done in the PostUpdate callback, so do it here instead)
  if roomIndex == GridRooms.ROOM_DEBUG_IDX and -- -3
     RPGlobals.raceVars.started == false then
    -- The starting position is 320, 380
    player.Position = Vector(320, 380)
  end
end

return RPPostRender
