-- RSX · datos de pilotos para el HUD de retransmisión (script online de Custom Shaders Patch)
--
-- Lo carga el servidor en el juego de cada piloto que entra (no hay que instalar nada).
--   1. Envía cada pocos segundos el combustible, el tamaño del depósito y el compuesto de
--      neumático del propio coche.
--   2. Recibe los mismos datos de los demás pilotos y los deja en el almacén compartido de la
--      sesión (ac.store), de donde los lee el RSX HUD (por ejemplo en RSXTV).
--
-- No dibuja nada y no toca el coche. El formato del mensaje debe coincidir con rsx/core.lua.

local SEND_EVERY = 5        -- segundos entre envíos si el combustible ha cambiado
local MIN_GAP = 1           -- segundos mínimos entre dos envíos
local VERSION = 2

-- Deja los datos de un coche donde el RSX HUD los busca: ".rsx.car.<índice>"
local function storeCar(index, liters, max, compound)
  ac.store('.rsx.car.' .. index, string.format('%.1f|%.1f|%s|%d', liters, max, compound or '', math.floor(ac.getSim().time)))
end

local carData = ac.OnlineEvent({
  ac.StructItem.key('rsxHudCarDataV2'),
  liters10 = ac.StructItem.uint16(),
  max10 = ac.StructItem.uint16(),
  compound = ac.StructItem.string(16),
}, function(sender, data)
  if sender and sender.index ~= 0 then
    storeCar(sender.index, data.liters10 / 10, data.max10 / 10, tostring(data.compound or ''))
  end
end)

local lastSent, lastLiters, lastCompound, lastPit = -1e9, -1, '', nil
local sentCount, failCount, lastMark = 0, 0, -1e9

ac.log('RSX datos pilotos: cargado (v' .. VERSION .. ')')

function script.update(dt)
  local sim = ac.getSim()
  local now = sim.time

  -- Marca de vida para el diagnóstico del HUD: "el script del servidor está cargado en este PC"
  if now - lastMark > 1000 then
    ac.store('.rsx.script', string.format('%d|%d|%d', VERSION, math.floor(now), sentCount))
    lastMark = now
  end

  local car = ac.getCar(0)
  if not car or not car.maxFuel or car.maxFuel <= 0 then return end
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
      sentCount = sentCount + 1
      if sentCount == 1 then ac.log('RSX datos pilotos: primer envío correcto') end
    else
      failCount = failCount + 1
      if failCount == 1 or failCount % 50 == 0 then ac.log('RSX datos pilotos: envío rechazado (' .. failCount .. ')') end
    end
  end
end
