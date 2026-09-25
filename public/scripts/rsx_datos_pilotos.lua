-- RSX · datos de pilotos para el HUD de retransmisión (script online de Custom Shaders Patch)
--
-- Lo carga el servidor en el juego de cada piloto que entra (no hay que instalar nada).
-- Cada pocos segundos envía el combustible, el tamaño del depósito y el compuesto de neumático
-- del propio coche. El RSX HUD (por ejemplo en RSXTV) lo recibe y lo muestra en el leaderboard,
-- en el modo FUEL y en el de neumáticos, y en el duelo.
--
-- No dibuja nada, no toca el coche y solo envía el mismo mensaje que el RSX HUD.
-- El formato del mensaje debe coincidir exactamente con rsx/core.lua (clave rsxHudCarDataV2).

local SEND_EVERY = 5        -- segundos entre envíos si el combustible ha cambiado
local MIN_GAP = 1           -- segundos mínimos entre dos envíos

local carData = ac.OnlineEvent({
  ac.StructItem.key('rsxHudCarDataV2'),
  liters10 = ac.StructItem.uint16(),
  max10 = ac.StructItem.uint16(),
  compound = ac.StructItem.string(16),
}, function() end)

local lastSent, lastLiters, lastCompound, lastPit = -1e9, -1, '', nil

function script.update(dt)
  local car = ac.getCar(0)
  if not car or not car.maxFuel or car.maxFuel <= 0 then return end
  local now = ac.getSim().time
  local liters = math.floor(car.fuel * 10 + 0.5)
  local compound = ac.getTyresLongName(0) or ''
  -- Al entrar o salir de boxes, o al cambiar de neumático, se envía enseguida
  local changed = car.isInPitlane ~= lastPit or compound ~= lastCompound
  local due = now - lastSent >= SEND_EVERY * 1000 and liters ~= lastLiters
  if (due or changed) and now - lastSent >= MIN_GAP * 1000 then
    local ok = carData({
      liters10 = liters,
      max10 = math.floor(car.maxFuel * 10 + 0.5),
      compound = compound:sub(1, 15),
    }, true)
    if ok then
      lastSent, lastLiters, lastCompound, lastPit = now, liters, compound, car.isInPitlane
    end
  end
end
