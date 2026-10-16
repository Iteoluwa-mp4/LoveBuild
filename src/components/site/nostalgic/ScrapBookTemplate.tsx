import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import gsap from "gsap"

type ScrapbookPage = {
    date: string
    title: string
    body: string
    tag: string
    colors: [string, string]
    doodle: string
}

const pages: ScrapbookPage[] = [
    {
        date: "chapter 01 · the beginning",
        title: "The day I found my favorite person.",
        body: "Some stories arrive loudly. Ours arrived softly — one conversation, one laugh, one impossible-to-ignore feeling at a time.",
        tag: "keep this one",
        colors: ["#f5b5a8", "#f9ddd1"],
        doodle: "✦",
    },
    {
        date: "chapter 02 · little things",
        title: "You make the ordinary feel golden.",
        body: "The long drives, the shared snacks, the way you look over when something makes you laugh. I keep all of it.",
        tag: "tiny magic",
        colors: ["#e9a9c5", "#f7d8e5"],
        doodle: "♡",
    },
    {
        date: "chapter 03 · our frequency",
        title: "We always find the same song.",
        body: "Even in the noise, there is this quiet rhythm that belongs only to us. I would know it anywhere.",
        tag: "on repeat",
        colors: ["#b6a7d8", "#e6dcf3"],
        doodle: "♫",
    },
    {
        date: "chapter 04 · still becoming",
        title: "My favorite place is next to you.",
        body: "Here is to all the places we have not been yet, all the photographs we have not taken, and every version of us still to come.",
        tag: "future file",
        colors: ["#eab37f", "#f6ddae"],
        doodle: "∞",
    },
]

function PaperDust() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
        camera.position.z = 8
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
        const geometry = new THREE.BufferGeometry()
        const points = new Float32Array(650 * 3)
        for (let i = 0; i < points.length; i += 3) {
            points[i] = (Math.random() - 0.5) * 15
            points[i + 1] = (Math.random() - 0.5) * 10
            points[i + 2] = (Math.random() - 0.5) * 8
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(points, 3))
        const material = new THREE.PointsMaterial({ color: 0xd18f88, size: 0.018, transparent: true, opacity: 0.32 })
        const dust = new THREE.Points(geometry, material)
        scene.add(dust)
        let frame = 0
        const resize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight, false)
            camera.aspect = window.innerWidth / window.innerHeight
            camera.updateProjectionMatrix()
        }
        const animate = () => {
            dust.rotation.y += 0.0003
            dust.rotation.x = Math.sin(Date.now() * 0.0002) * 0.03
            renderer.render(scene, camera)
            frame = requestAnimationFrame(animate)
        }
        resize()
        animate()
        window.addEventListener("resize", resize)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener("resize", resize)
            geometry.dispose()
            material.dispose()
            renderer.dispose()
        }
    }, [])

    return <canvas className="paper-dust" ref={canvasRef} aria-hidden="true" />
}

function Tape({ className = "" }: { className?: string }) {
    return <span className={`tape ${className}`} aria-hidden="true" />
}

function PhotoPlaceholder({ page, side }: { page: ScrapbookPage; side: "left" | "right" }) {
    const label = side === "left" ? "a little moment" : "filed under: us"
    return (
        <div className={`photo ${side}`} style={{ background: `linear-gradient(145deg, ${page.colors[0]}, ${page.colors[1]})` }}>
            <div className="photo-glow" />
            <span className="photo-label">{label}</span>
            <span className="photo-symbol">{page.doodle}</span>
            <span className="photo-number">0{pages.indexOf(page) + 1}</span>
        </div>
    )
}

export default function App() {
    const bookRef = useRef<HTMLDivElement>(null)
    const [active, setActive] = useState(0)
    const [isFlipping, setIsFlipping] = useState(false)
    const current = pages[active]
    const next = pages[(active + 1) % pages.length]
    const progress = useMemo(() => `${active + 1} / ${pages.length}`, [active])

    useEffect(() => {
        gsap.fromTo(".scrap-header > *", { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out" })
        gsap.fromTo(".book-wrap", { y: 35, opacity: 0, rotate: -1 }, { y: 0, opacity: 1, rotate: 0, duration: 1.1, ease: "power3.out", delay: 0.25 })
        gsap.fromTo(".intro-copy > *", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, stagger: 0.09, ease: "power3.out", delay: 0.45 })
    }, [])

    const turnPage = (direction: 1 | -1) => {
        if (isFlipping) return
        setIsFlipping(true)
        const page = bookRef.current?.querySelector(".turning-page")
        const rotation = direction === 1 ? -180 : 180
        if (!page) {
            setActive((active + direction + pages.length) % pages.length)
            setIsFlipping(false)
            return
        }
        gsap.set(page, { transformOrigin: direction === 1 ? "left center" : "right center", rotateY: 0, zIndex: 5 })
        gsap.to(page, {
            rotateY: rotation,
            duration: 0.9,
            ease: "power2.inOut",
            onComplete: () => {
                setActive((active + direction + pages.length) % pages.length)
                gsap.set(page, { clearProps: "all" })
                setIsFlipping(false)
            },
        })
    }

    return (
        <div className="scrapbook-app">
            <PaperDust />
            <div className="paper-texture" />
            <header className="scrap-header">
                <a className="scrap-logo" href="#top"><span>♡</span> our little archive</a>
                <p>an ongoing collection of us · 2026</p>
                <div className="header-stamp">made with<br /><b>love</b></div>
            </header>

            <main id="top">
                <section className="intro-copy">
                    <p className="small-label">dear you,</p>
                    <h1>Things I want<br />to <em>remember.</em></h1>
                    <p className="intro-text">A hand-assembled little book of my favorite details — the ones that make being yours feel like the loveliest kind of luck.</p>
                    <span className="squiggle">〰〰〰</span>
                </section>

                <section className="book-wrap" aria-label="Flipping scrapbook gallery">
                    <div className="book-shadow" />
                    <div className="book" ref={bookRef}>
                        <div className="book-spine" />
                        <div className="page page-back left-page">
                            <div className="page-corner" />
                            <PhotoPlaceholder page={current} side="left" />
                            <p className="scribble">saved for later</p>
                        </div>
                        <div className="page page-back right-page">
                            <div className="page-corner" />
                            <p className="page-date">{current.date}</p>
                            <h2>{current.title}</h2>
                            <p className="page-body">{current.body}</p>
                            <div className="stamp">{current.tag}</div>
                            <span className="page-doodle">{current.doodle}</span>
                            <span className="page-number">{String(active + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="page turning-page">
                            <Tape className="tape-top" />
                            <div className="page-turn-face">
                                <div className="page-date">{next.date}</div>
                                <h2>{next.title}</h2>
                                <p className="page-body">{next.body}</p>
                                <div className="stamp">{next.tag}</div>
                            </div>
                            <div className="page-turn-back"><PhotoPlaceholder page={next} side="right" /></div>
                        </div>
                    </div>
                    <div className="book-controls">
                        <button onClick={() => turnPage(-1)} disabled={isFlipping} aria-label="Previous page">← <span>previous</span></button>
                        <div className="page-progress"><span>{progress}</span><i><b style={{ width: `${((active + 1) / pages.length) * 100}%` }} /></i></div>
                        <button onClick={() => turnPage(1)} disabled={isFlipping} aria-label="Next page"><span>next</span> →</button>
                    </div>
                </section>

                <section className="closing-note">
                    <Tape className="note-tape" />
                    <p className="small-label">p.s.</p>
                    <p>There are a million ways to say I love you.<br /><em>I hope I show you in all of them.</em></p>
                    <span className="heart-line">♡ ───────── ♡</span>
                </section>
            </main>

            <footer className="scrap-footer"><span>from my heart,</span><strong>always yours</strong><span>page {progress}</span></footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');
                :root { --paper:#fffaf4; --paper-deep:#f4e8dd; --ink:#57464a; --muted:#9b8585; --peach:#f3b09e; --rose:#db8da2; --wine:#925467; }
                * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; background:#f3e6da; color:var(--ink); font-family:'Manrope',sans-serif; }
                button,a { font:inherit; } a { color:inherit; text-decoration:none; }
                .scrapbook-app { min-height:100vh; overflow:hidden; position:relative; background:radial-gradient(circle at 78% 8%, #fff8f2 0, transparent 25%), linear-gradient(125deg,#f4e5d9,#f7eee7 46%,#efd8d1); }
                .paper-dust,.paper-texture { position:fixed; inset:0; width:100%; height:100%; pointer-events:none; }.paper-dust { opacity:.55; z-index:0; }.paper-texture { z-index:1; opacity:.25; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.14'/%3E%3C/svg%3E"); }
                .scrap-header,main,.scrap-footer { position:relative; z-index:2; }.scrap-header { max-width:1380px; margin:auto; padding:28px 6vw; display:grid; grid-template-columns:1fr 1fr 1fr; align-items:center; border-bottom:1px solid rgba(126,87,86,.2); color:var(--muted); }.scrap-logo { font-family:'Caveat',cursive; font-size:25px; color:var(--wine); }.scrap-logo span { color:var(--rose); font-size:21px; margin-right:8px; }.scrap-header > p { margin:0; text-align:center; font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.13em; }.header-stamp { justify-self:end; border:1px solid var(--rose); color:var(--rose); width:54px; height:54px; border-radius:50%; text-align:center; padding-top:11px; transform:rotate(10deg); font:9px 'DM Mono',monospace; text-transform:uppercase; line-height:1.1; }.header-stamp b { font:18px 'Caveat',cursive; text-transform:none; }
                main { max-width:1240px; margin:auto; padding:10vh 5vw 15vh; }.intro-copy { width:min(470px,100%); margin-left:4vw; position:relative; }.small-label { margin:0 0 16px; color:var(--rose); font:600 16px 'Caveat',cursive; letter-spacing:.05em; }.intro-copy h1 { margin:0; font:600 clamp(54px,7vw,92px)/.9 'Fraunces',serif; letter-spacing:-.065em; color:#6b5052; }.intro-copy h1 em { color:var(--rose); font-style:italic; }.intro-text { color:var(--muted); font-size:13px; line-height:1.8; max-width:340px; margin:28px 0 12px; }.squiggle { color:var(--peach); font:30px 'Caveat',cursive; letter-spacing:-.12em; }
                .book-wrap { width:min(1030px,100%); margin:75px auto 0; perspective:1800px; }.book-shadow { position:absolute; left:5%; right:5%; bottom:20px; height:45px; background:rgba(116,76,78,.2); filter:blur(23px); border-radius:50%; }.book { height:clamp(500px,54vw,650px); position:relative; transform-style:preserve-3d; display:grid; grid-template-columns:1fr 1fr; filter:drop-shadow(0 25px 20px rgba(105,68,72,.12)); }.book:before,.book:after { content:''; position:absolute; top:1.5%; bottom:1.5%; width:15px; background:linear-gradient(90deg,#d7bcae,#f4e8de,#cda99d); z-index:-1; }.book:before { left:-8px; border-radius:7px 0 0 7px; }.book:after { right:-8px; border-radius:0 7px 7px 0; }.book-spine { position:absolute; z-index:6; width:18px; top:0; bottom:0; left:calc(50% - 9px); background:linear-gradient(90deg,rgba(139,85,84,.2),rgba(255,255,255,.55),rgba(139,85,84,.17)); box-shadow:0 0 10px rgba(107,70,72,.12); }.page { position:relative; overflow:hidden; background:var(--paper); padding:clamp(32px,5vw,72px); box-shadow:inset 0 0 0 1px rgba(112,75,73,.07); }.page-back { z-index:2; }.left-page { border-radius:7px 0 0 7px; background:linear-gradient(120deg,#fffaf4,#fbf0e9); }.right-page { border-radius:0 7px 7px 0; background:linear-gradient(245deg,#fffaf4,#f8ece4); }.page-corner { position:absolute; width:55px; height:55px; right:0; bottom:0; background:linear-gradient(135deg,transparent 49%,#efdcd1 50%); opacity:.8; }.page-corner:after { content:''; position:absolute; right:8px; bottom:9px; width:12px; height:1px; background:#d19b99; transform:rotate(-45deg); }.photo { position:relative; width:min(82%,360px); aspect-ratio:1.08; margin:15% auto 0; transform:rotate(-4deg); box-shadow:0 12px 20px rgba(106,69,71,.16); overflow:hidden; border:10px solid #fffdf9; }.photo.right { transform:rotate(4deg); }.photo:before { content:''; position:absolute; inset:0; background:linear-gradient(115deg,rgba(255,255,255,.35),transparent 38%,rgba(126,67,82,.1)); }.photo-glow { position:absolute; width:65%; aspect-ratio:1; border-radius:50%; left:13%; top:12%; background:rgba(255,255,255,.28); filter:blur(16px); }.photo-label { position:absolute; left:14px; top:13px; color:#fffaf4; font:13px 'Caveat',cursive; transform:rotate(-4deg); }.photo-symbol { position:absolute; inset:0; display:grid; place-items:center; color:rgba(255,255,255,.8); font:100px 'Caveat',cursive; }.photo-number { position:absolute; right:12px; bottom:10px; color:#fffaf4; font:10px 'DM Mono',monospace; }.scribble { text-align:center; color:var(--rose); font:22px 'Caveat',cursive; transform:rotate(-3deg); margin:18px 0 0; }.tape { position:absolute; width:132px; height:28px; background:rgba(242,190,169,.62); box-shadow:0 1px 2px rgba(102,62,62,.08); z-index:3; }.tape:before { content:''; position:absolute; inset:0; opacity:.25; background:repeating-linear-gradient(90deg,transparent 0 6px,rgba(255,255,255,.7) 7px 8px); }.tape-top { top:19px; left:calc(50% - 66px); transform:rotate(-3deg); }
                .page-date { margin:2px 0 27px; color:var(--rose); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }.right-page h2,.page-turn-face h2 { max-width:360px; margin:0; color:#6b5052; font:600 clamp(34px,4.4vw,57px)/.96 'Fraunces',serif; letter-spacing:-.06em; }.page-body { max-width:300px; color:#9a7e80; font-size:13px; line-height:1.8; margin:27px 0; }.stamp { display:inline-block; color:var(--rose); border:1px solid var(--rose); padding:7px 10px; transform:rotate(-8deg); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.08em; }.page-doodle { position:absolute; right:13%; bottom:17%; color:var(--peach); font:80px 'Caveat',cursive; transform:rotate(9deg); opacity:.78; }.page-number { position:absolute; bottom:29px; right:42px; color:#bca3a1; font:10px 'DM Mono',monospace; }.turning-page { position:absolute; inset:0 0 0 50%; z-index:4; transform-style:preserve-3d; backface-visibility:hidden; padding:0; background:var(--paper); }.page-turn-face,.page-turn-back { position:absolute; inset:0; backface-visibility:hidden; padding:clamp(32px,5vw,72px); }.page-turn-back { transform:rotateY(180deg); background:var(--paper-deep); }.page-turn-back .photo { margin-top:17%; }.book-controls { display:flex; align-items:center; justify-content:space-between; padding:26px 2px 0; color:var(--wine); }.book-controls button { border:0; background:transparent; color:var(--wine); cursor:pointer; padding:8px; font:17px 'Caveat',cursive; }.book-controls button span { font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.09em; }.book-controls button:disabled { opacity:.45; }.page-progress { display:flex; align-items:center; gap:13px; color:var(--muted); font:10px 'DM Mono',monospace; }.page-progress i { display:block; width:130px; height:2px; background:#d9bdb5; }.page-progress b { display:block; height:100%; background:var(--rose); transition:width .3s; }
                .closing-note { position:relative; width:min(500px,90%); margin:16vh auto 0; padding:45px 40px 38px; text-align:center; background:#fff7ec; transform:rotate(2deg); box-shadow:0 8px 22px rgba(117,77,75,.12); }.note-tape { top:-13px; left:calc(50% - 66px); transform:rotate(-3deg); }.closing-note p:not(.small-label) { color:var(--wine); font:23px/1.35 'Caveat',cursive; margin:0; }.closing-note em { color:var(--rose); }.heart-line { display:block; margin-top:25px; color:var(--peach); font:19px 'Caveat',cursive; }.scrap-footer { max-width:1380px; margin:auto; padding:23px 6vw; border-top:1px solid rgba(126,87,86,.2); display:flex; justify-content:space-between; color:#aa8f8c; font:11px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.09em; }.scrap-footer strong { color:var(--rose); font:19px 'Caveat',cursive; text-transform:none; letter-spacing:0; }
                @media (max-width:760px) { .scrap-header { grid-template-columns:1fr auto; padding:22px 6vw; }.scrap-header > p { display:none; }.header-stamp { width:47px; height:47px; font-size:8px; padding-top:9px; }.header-stamp b { font-size:16px; } main { padding:8vh 5vw 13vh; }.intro-copy { margin-left:2vw; }.book-wrap { margin-top:55px; }.book { height:590px; display:block; }.book-spine { left:10px; width:11px; }.book:before { left:-5px; }.book:after { right:-5px; }.left-page { display:none; }.right-page { border-radius:7px; padding:42px 29px; }.turning-page { left:0; padding:0; }.page-turn-face,.page-turn-back { padding:42px 29px; }.right-page h2,.page-turn-face h2 { font-size:44px; }.page-body { max-width:260px; }.page-doodle { right:12%; bottom:14%; }.page-progress i { width:75px; }.book-controls { padding-top:22px; }.closing-note { padding:42px 24px 32px; }.scrap-footer { font-size:8px; padding:20px 5vw; }.scrap-footer span:first-child { display:none; } }
            `}</style>
        </div>
    )
}
