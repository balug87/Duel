/* DUEL — gun elevation aiming (cursor sets arm pitch; shots follow the barrel) */
window.GB = window.GB || {};
GB.aim = (function () {
  // Must match characters.js armAngle constants.
  const ARM_DOWN = 1.32, ARM_LEVEL = -0.06;
  const AIM_UP = -0.55, AIM_DOWN = 1.12;
  const RECOIL_KICK = 0.22; // same as drawSide: armAngle(raise) - recoil * 0.22
  const PL = { x: 115, y: 470, scale: 1.35, facing: 1 };

  function clampRaise(r) {
    return Math.max(0, Math.min(1.4, r));
  }

  function barrelAngle(raise, recoil) {
    return ARM_DOWN + (ARM_LEVEL - ARM_DOWN) * (raise || 0) - (recoil || 0) * RECOIL_KICK;
  }

  function raiseFromAim(ax, ay, geo) {
    geo = geo || PL;
    const s = geo.scale, f = geo.facing;
    const sx = geo.x + 2 * s * f;
    const sy = geo.y - 128 * s;
    const localA = Math.atan2(ay - sy, (ax - sx) * f);
    const clamped = Math.max(AIM_UP, Math.min(AIM_DOWN, localA));
    return (clamped - ARM_DOWN) / (ARM_LEVEL - ARM_DOWN);
  }

  function barrelDir(raise, facing, recoil) {
    const a = barrelAngle(raise, recoil);
    return { x: Math.cos(a) * facing, y: Math.sin(a) };
  }

  return { raiseFromAim, barrelDir, barrelAngle, clampRaise, ARM_DOWN, ARM_LEVEL, RECOIL_KICK };
})();
