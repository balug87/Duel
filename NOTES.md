# Notes on the Matter.js ragdoll pass

These are the comments that go with the latest push. The playable game is still the same static HTML5 site so GitHub Pages keeps working — no build step.

## What changed

The previous death animation was a **Verlet stick figure** (`makeRagdoll` / `stepRagdoll` in `js/duel.js`). It froze after ~1.3 seconds and never really went limp.

That whole block is gone. Deaths now spawn a **Matter.js rigid-body cowboy**:

- bodies: head, torso, gun upper/lower, far arm upper/lower, near/far thigh + shin
- pin joints at neck, shoulders, elbows, hips, knees (`length: 0`, stiffness ~0.7)
- knockback along the bullet, extra spin on the part that took the hit
- **Buckets** gore can tear the killing limb off the doll instead of leaving a second flying sprite
- after they're down you can keep shooting; in Buckets a hit can snap the next joint (`TORN OFF!`)

Files:

| File | Role |
|---|---|
| `js/ragdoll.js` | Matter world, spawn, step, draw, hit-test, tear |
| `js/duel.js` | death hook, corpse shots, arterial `gush`, comments |
| `index.html` | loads Matter 0.20 from cdnjs, then `ragdoll.js` |

## Matter.js traps (read this before you "fix" the joints)

1. **`Composite.create({ bodies, constraints })` does not parent children.** Always `Composite.add(composite, bodyOrConstraint)` or the constraints never enter the engine and the doll explodes into loose boxes.
2. **`pointA` / `pointB` are world-space offsets from `body.position` at creation.** Matter then rotates them as the body spins. Do **not** pass unrotated local coords on an already-angled arm — the first solver step will yank the joint across the screen.
3. **Pin joints want `length: 0`.** A rest-length that doesn't match the spawn pose is a bomb.
4. **One negative collision group per doll** so parts don't fight each other. Ground stays category `0x0001` so they still land in the dirt.

## How to try it

Rest on the cylinder → FIRE → headshot. The body should fold, not rotate as one sprite. Pump the corpse while the "IS DOWN!" banner is up.

If Matter fails to load (blocked CDN), `GB.ragdoll.available()` is false and death falls back to the posed sprite so the duel still ends cleanly.
