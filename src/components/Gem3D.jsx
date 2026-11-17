// The BeetFit mark in 3D: a faceted lime gem around the brand's square-in-square, with an orbit of
// particles. Used only on the welcome screen and streak milestones (battery: it renders on demand,
// pauses off-screen, caps pixel ratio and stops after `seconds` unless `loop`).
import React, { useEffect, useRef } from 'react'
import { AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight, EdgesGeometry, Group, IcosahedronGeometry, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PointLight, Points, PointsMaterial, SRGBColorSpace, Scene, WebGLRenderer } from 'three'
import { reducedMotion } from '../lib/motion.js'

const LIME = 0xe0fd90, BLUE = 0x303bff, VIOLET = 0x7d70f6

export default function Gem3D({ size = 200, burst = false, loop = true, seconds = 6, className = '' }) {
  const host = useRef(null)
  const fallback = useRef(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      fallback.current?.classList.add('on')
      return
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    renderer.setPixelRatio(dpr)
    renderer.setSize(size, size)
    renderer.outputColorSpace = SRGBColorSpace
    el.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(36, 1, 0.1, 50)
    camera.position.set(0, 0, 7)

    scene.add(new AmbientLight(0xffffff, 0.35))
    const key = new DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key)
    const rim = new PointLight(BLUE, 30, 12); rim.position.set(-3, -1.5, 2); scene.add(rim)
    const rim2 = new PointLight(VIOLET, 18, 12); rim2.position.set(2.5, -2.5, -1); scene.add(rim2)

    const group = new Group()
    scene.add(group)

    // Gem: low-poly icosahedron, flat shaded, with crisp edges.
    const geo = new IcosahedronGeometry(1.25, 0)
    const mat = new MeshStandardMaterial({ color: LIME, roughness: 0.35, metalness: 0.15, flatShading: true, emissive: LIME, emissiveIntensity: 0.08 })
    const gem = new Mesh(geo, mat)
    group.add(gem)
    const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: 0x1d1d1d, transparent: true, opacity: 0.35 }))
    gem.add(edges)

    // Square-in-square: two wire squares orbiting the gem on tilted planes.
    const square = (s, color, opacity) => {
      const g = new EdgesGeometry(new PlaneGeometry(s, s))
      return new LineSegments(g, new LineBasicMaterial({ color, transparent: true, opacity }))
    }
    const outer = square(2.8, LIME, 0.55); outer.rotation.x = 1.15
    const inner = square(2.2, BLUE, 0.8); inner.rotation.set(0.5, 0.9, 0)
    group.add(outer, inner)

    // Particle orbit.
    const N = 140
    const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.9 + Math.random() * 0.8, y = (Math.random() - 0.5) * 0.9
      seed[i * 3] = a; seed[i * 3 + 1] = r; seed[i * 3 + 2] = y
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r
    }
    const pg = new BufferGeometry()
    pg.setAttribute('position', new BufferAttribute(pos, 3))
    const pts = new Points(pg, new PointsMaterial({ color: LIME, size: 0.055, transparent: true, opacity: 0.85, depthWrite: false }))
    pts.rotation.x = 0.35
    group.add(pts)

    // Pointer parallax (tilt toward the finger).
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = e => {
      const r = el.getBoundingClientRect()
      const p = e.touches?.[0] || e
      tilt.ty = ((p.clientX - (r.left + r.width / 2)) / window.innerWidth) * 1.2
      tilt.tx = ((p.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.8
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const still = reducedMotion()
    let raf = 0, visible = true, t0 = performance.now(), last = t0
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame) })
    io.observe(el)

    function frame(now) {
      raf = 0
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000
      // Burst: a quick spring pop and particles thrown outward, then back to orbit.
      const b = burst ? Math.max(0, 1 - t / 1.6) : 0
      const pop = burst ? 1 + 0.35 * Math.exp(-t * 4) * Math.sin(t * 14) : 1
      group.scale.setScalar(Math.max(0.3, pop * (burst ? Math.min(1, t * 3 + 0.3) : 1)))

      gem.rotation.y += dt * 0.55
      gem.rotation.x = Math.sin(t * 0.6) * 0.25
      outer.rotation.z += dt * 0.35
      inner.rotation.z -= dt * 0.6
      inner.rotation.y += dt * 0.25
      for (let i = 0; i < N; i++) {
        const a = seed[i * 3] + t * (0.25 + (i % 7) * 0.02), r = seed[i * 3 + 1] * (1 + b * 1.6), y = seed[i * 3 + 2] * (1 + b)
        pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y + Math.sin(t * 1.3 + i) * 0.05; pos[i * 3 + 2] = Math.sin(a) * r
      }
      pg.attributes.position.needsUpdate = true
      pts.material.opacity = 0.85 * (1 - b * 0.5)

      tilt.x += (tilt.tx - tilt.x) * 0.06; tilt.y += (tilt.ty - tilt.y) * 0.06
      group.rotation.x = tilt.x; group.rotation.y = tilt.y
      renderer.render(scene, camera)

      const done = !loop && t > seconds
      if (!still && visible && !done && document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const vis = () => { if (document.visibilityState === 'visible' && !raf && !still) { last = performance.now(); raf = requestAnimationFrame(frame) } }
    document.addEventListener('visibilitychange', vis)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', vis)
      scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      renderer.dispose()
      renderer.forceContextLoss?.()
      renderer.domElement.remove()
    }
  }, [size, burst, loop, seconds])

  return (
    <div className={'gem3d ' + className} style={{ width: size, height: size }} ref={host} aria-hidden="true">
      <span className="gem3d-fb" ref={fallback}><i /></span>
    </div>
  )
}
