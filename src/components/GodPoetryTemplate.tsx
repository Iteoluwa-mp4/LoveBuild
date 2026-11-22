import { useRef, type CSSProperties } from "react"
import useScrollReveal from "../hooks/useScrollReveal"
import { FALLBACK_ART } from "./site/godpoetry/art"

/**
 * The God Poetry template.
 *
 * A single long-form blessing: cover, word, poem, letter, prayer, closing.
 * The fixed words are the page's liturgy; the props carry the parts that
 * belong to the recipient — her name and monogram, the two-line title, the
 * dedication, and the photographs. A wrapper in `site/godpoetry/HomePage.tsx`
 * maps a saved Site onto these props, so this file stays a plain presentational
 * component and can also be rendered on its own.
 *
 * Scroll reveals use the shared IntersectionObserver hook rather than GSAP
 * ScrollTrigger. The product rule is deliberate: the hidden state must come
 * from JavaScript with a failsafe, so a broken animation can never leave the
 * words of someone's gift at zero opacity.
 */
type GodPoetryTemplateProps = {
    friendName?: string | undefined
    /** One or two lines; the last line gets the gold italic accent. */
    lines?: readonly string[] | undefined
    dedication?: string | undefined
    accent?: string | undefined
    /** The monogram for the top-left mark. Empty falls back to "grace notes". */
    initials?: string | undefined
    heroImage?: string | undefined
    heroImageAlt?: string | undefined
    poemImage?: string | undefined
    poemImageAlt?: string | undefined
    /** Where the top bar's gallery link goes. Omit to hide the link. */
    galleryHref?: string | undefined
    homeHref?: string | undefined
}

const GOD_POETRY_MOTION_CSS = `
    .god-hero-kicker,.god-hero-title .god-line,.god-hero-subtitle,.god-hero-meta,.god-hero-art,.god-scroll-reveal,.god-verse-line {
        transition: opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1), clip-path 1.1s cubic-bezier(.65,0,.35,1);
        transition-delay: var(--reveal-delay,0ms);
    }
    .god-hero-kicker.js-reveal-pending,.god-hero-title .god-line.js-reveal-pending,.god-hero-subtitle.js-reveal-pending,.god-hero-meta.js-reveal-pending,.god-scroll-reveal.js-reveal-pending,.god-verse-line.js-reveal-pending {
        opacity: 0;
        transform: translateY(28px);
    }
    .god-hero-title .god-line.js-reveal-pending { transform: translateY(105%); }
    .god-hero-art.js-reveal-pending { opacity: 1; transform: none; clip-path: inset(0 0 100% 0); }
    .god-hero-art.js-reveal-shown { clip-path: inset(0 0 0 0); }
    .god-sun { animation: god-sun-drift 9s ease-in-out infinite alternate; }
    .god-orbit { animation: god-orbit-turn 55s linear infinite; }
    @keyframes god-sun-drift {
        from { transform: translate(0,0); }
        to { transform: translate(-8px,20px); }
    }
    @keyframes god-orbit-turn {
        from { transform: rotate(-19deg) skewX(-10deg); }
        to { transform: rotate(341deg) skewX(-10deg); }
    }
    @media (prefers-reduced-motion: reduce) {
        .god-sun,.god-orbit { animation: none; }
    }
`

function OrnateRule({ label }: { label?: string }) {
    return <div className="god-rule"><span>✦</span>{label && <small>{label}</small>}<span>✦</span></div>
}

/**
 * Everything this page reveals, in one selector.
 *
 * The cover pieces are included so the opening still arrives in sequence, and
 * the sections and verse lines carry the same reveal the original timeline gave
 * them. Nothing is hidden by CSS before this runs, so a missing observer costs
 * the animation rather than the blessing — see `useScrollReveal`.
 */
const REVEAL_SELECTOR = [
    ".god-hero-kicker",
    ".god-hero-title .god-line",
    ".god-hero-subtitle",
    ".god-hero-meta",
    ".god-hero-art",
    ".god-scroll-reveal",
    ".god-verse-line",
].join(", ")

/** The cover title as shipped, used when every stored line is blank. */
const DEFAULT_LINES = ["A garden", "of grace."] as const

export default function GodPoetryTemplate({
    friendName = "Cristian",
    lines,
    dedication = "For the woman who carries light gently.",
    accent = "#b08d4f",
    initials = "",
    heroImage,
    heroImageAlt,
    poemImage,
    poemImageAlt,
    galleryHref,
    homeHref,
}: GodPoetryTemplateProps) {
    const rootRef = useRef<HTMLDivElement>(null)

    /*
      Blank lines drop out, and an entirely blank title falls back to the cover
      the template shipped with — the same rule every other template follows,
      so clearing "First impression" shortens the heading instead of erasing it.
    */
    const storedLines = (lines ?? []).map((line) => line.trim()).filter(Boolean)
    const coverLines = storedLines.length > 0 ? storedLines : [...DEFAULT_LINES]
    const mark = initials.trim() || "grace notes"

    useScrollReveal(rootRef, REVEAL_SELECTOR)

    return (
        <div ref={rootRef} className="god-template" style={{ "--god-accent": accent } as CSSProperties}>
            <style>{GOD_POETRY_MOTION_CSS}</style>
            <div className="god-noise" />
            <header className="god-nav"><a href={homeHref ?? "#top"} className="god-mark"><span>✦</span> {mark}</a><nav><a href="#word">the word</a><a href="#poem">the poem</a><a href="#letter">a blessing</a>{galleryHref && <a href={galleryHref}>the little things</a>}</nav><span className="god-nav-meta">an offering / 01</span></header>

            <main id="top">
                <section className="god-hero">
                    <div className="god-hero-copy"><p className="god-hero-kicker"><span /> for {friendName}</p><h1 className="god-hero-title">{coverLines.map((line, index) => <span className="god-line" key={`${index}-${line}`}>{index === coverLines.length - 1 && coverLines.length > 1 ? <em>{line}</em> : line}</span>)}</h1><p className="god-hero-subtitle">{dedication}</p><p className="god-hero-meta">a long-form blessing · written with love</p></div><div className="god-hero-art"><img src={heroImage || FALLBACK_ART[0]} alt={heroImage ? (heroImageAlt || `A photograph for ${friendName}`) : "A warm abstract landscape with a glowing sun"} /><div className="god-sun" /><div className="god-orbit" /><span className="god-art-caption">the light is not yours to earn<br />it is yours to receive</span></div>
                    <div className="god-hero-foot"><span>scroll slowly</span><span>↓</span><span>psalm 46:5</span></div>
                </section>

                <section id="word" className="god-word god-scroll-reveal"><div className="god-section-label"><span>01</span> the word / a place to begin</div><div className="god-word-grid"><div><h2>She is held<br />by something<br /><em>holy.</em></h2><div className="god-scripture"><span>“</span><p>God is within her, she will not fall.</p><small>— Psalm 46:5</small></div></div><div className="god-word-body"><p className="god-lede">There are people who enter a room and make it brighter. Not because they ask to be seen, but because they have learned how to carry a little light for everyone else.</p><p>Christ is present in the gentleness she gives away. In the patience she keeps when nobody is watching. In the way she makes room at the table, remembers the small thing, and chooses hope even when it would be easier to close the door.</p><p>She is not required to be unbreakable. She is allowed to be human, to rest, to ask, to begin again. The grace that finds her is not hurried. It knows her name.</p><OrnateRule label="a quiet certainty" /></div></div></section>

                <section className="god-verse-field god-scroll-reveal"><div className="god-verse-heading"><span className="god-section-label"><span>02</span> field notes / the ordinary miracle</span><span className="god-verse-symbol">☼</span></div><div className="god-verse-lines"><p className="god-verse-line">May the morning meet you softly.</p><p className="god-verse-line">May the work of your hands feel meaningful.</p><p className="god-verse-line">May you remember that being tired</p><p className="god-verse-line god-verse-indent">is not the same as being lost.</p><p className="god-verse-line">May the Lord keep the tender places.</p><p className="god-verse-line god-verse-indent">May He make a home in your courage.</p><p className="god-verse-line">And when the road turns dark,</p><p className="god-verse-line god-verse-indent">may you find that love has been there</p><p className="god-verse-line god-verse-indent">lighting the next step all along.</p></div><div className="god-verse-foot"><span>original poem / for {friendName}</span><span>✦</span><span>read in the quiet</span></div></section>

                <section id="poem" className="god-poem god-scroll-reveal"><div className="god-section-label"><span>03</span> the poem / what I hope you know</div><div className="god-poem-layout"><div className="god-poem-image"><img src={poemImage || FALLBACK_ART[1]} alt={poemImage ? (poemImageAlt || `A photograph for ${friendName}`) : "An abstract horizon in soft blue and gold"} /><span>there is<br />still a horizon</span></div><div className="god-poem-copy"><h2>For the days<br />you feel <em>small.</em></h2><div className="god-poem-text"><p>There is a God<br />who does not measure you<br />by your brightest day.</p><p>He knows the hidden rooms,<br />the questions beneath<br />the yes, the almost,<br />the not yet.</p><p>He calls you beloved<br />before you have built<br />anything beautiful.</p><p>So go gently.<br />The world is not waiting<br />for a perfect offering.</p><p>Bring your whole heart.<br />Let grace do<br />what striving cannot.</p></div><div className="god-poem-signature">with tenderness,<br /><strong>the One who made you</strong></div></div></div></section>

                <section className="god-quote god-scroll-reveal"><span className="god-quote-mark">“</span><p>You are not behind. You are being formed.</p><OrnateRule /></section>

                <section id="letter" className="god-letter god-scroll-reveal"><div className="god-section-label"><span>04</span> a letter / from someone who believes in you</div><div className="god-letter-layout"><div className="god-letter-heading"><h2>Dear<br /><em>{friendName},</em></h2><span className="god-letter-flourish">♡</span></div><div className="god-letter-copy"><p>I hope you never forget that your life is not an accident of small moments. It is a story being written with a patience larger than your own.</p><p>When you feel uncertain, may you be surrounded by reminders: a song that arrives at the right time, a friend who says the honest thing, a sliver of sun across the floor. May you recognise them as little mercies.</p><p>I pray you keep the part of yourself that still believes beauty can be practical. That kindness can be brave. That faith can be a quiet, daily yes.</p><p>And when you cannot feel God near, may you trust that nearness is not always a feeling. Sometimes it is the strength to stand. Sometimes it is the person who stays. Sometimes it is simply the next breath.</p><p className="god-letter-ending">You are loved beyond performance,<br />known beyond explanation,<br />and never walking alone.</p><div className="god-hand-signoff">always,<br /><em>your friend</em></div></div></div></section>

                <section className="god-prayer god-scroll-reveal"><div className="god-prayer-card"><div className="god-section-label"><span>05</span> a small prayer</div><span className="god-prayer-cross">✝</span><p>My lord,<br />keep her close to the things<br />that make her spirit honest.</p><p>Give her rest without guilt,<br />courage without noise,<br />and people who recognise<br />the gift of her presence.</p><p>Make a way where she sees none.<br />Be her shelter in the weather.<br />Remind her, gently and often,<br />that she is already loved.</p><span className="god-amen">amen.</span></div></section>

                <section className="god-closing god-scroll-reveal"><OrnateRule label="the final note" /><h2>Go in peace.<br /><em>Carry the light.</em></h2><p>For {friendName}, with love —<br />and with every good thing still ahead.</p><div className="god-closing-mark">✦</div><small>grace notes / an offering made slowly</small></section>
            </main>

            <footer className="god-footer"><span>grace notes</span><span>for {friendName}</span><span>∞</span></footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
                :root { --god-paper:#f4f0e6; --god-ink:#182d32; --god-soft:#687679; --god-line:#c4c4b5; --god-warm:#e5d2a4; }
                * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; background:var(--god-paper); color:var(--god-ink); font-family:Inter,Arial,sans-serif; } a { color:inherit; text-decoration:none; }
                /* SiteShell applies the preset's pale text; this paper needs its own ink anchor. */
                .god-template { min-height:100vh; overflow:hidden; position:relative; background:var(--god-paper); color:var(--god-ink); }.god-noise { position:fixed; z-index:12; pointer-events:none; inset:0; opacity:.13; mix-blend-mode:multiply; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E"); }.god-nav,main,.god-footer { position:relative; z-index:2; }.god-nav { width:min(1360px,100%); margin:auto; display:flex; align-items:center; justify-content:space-between; padding:25px 5vw; border-bottom:1px solid var(--god-line); color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }.god-mark { color:var(--god-ink); font:600 18px 'Fraunces',serif; letter-spacing:-.03em; text-transform:none; }.god-mark span { color:var(--god-accent); font-size:14px; margin-right:7px; }.god-nav nav { display:flex; gap:28px; }.god-nav nav a:hover { color:var(--god-accent); }.god-nav-meta { color:var(--god-accent); }
                main { width:min(1200px,100%); margin:auto; }.god-hero { min-height:calc(100vh - 70px); padding:9vh 5vw 35px; position:relative; display:grid; grid-template-columns:.86fr 1.14fr; align-items:center; column-gap:7vw; border-bottom:1px solid var(--god-line); }.god-hero-copy { position:relative; z-index:2; }.god-hero-kicker { color:var(--god-accent); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; overflow:hidden; }.god-hero-kicker span { display:inline-block; width:33px; margin-right:12px; border-top:1px solid var(--god-accent); vertical-align:middle; }.god-hero-title { margin:25px 0 32px; font:600 clamp(67px,9vw,132px)/.8 'Fraunces',serif; letter-spacing:-.09em; }.god-line { display:block; overflow:hidden; }.god-hero-title em { color:var(--god-accent); font-style:italic; }.god-hero-subtitle { max-width:310px; color:var(--god-soft); font:italic 22px/1.22 'Fraunces',serif; }.god-hero-meta { margin-top:45px; color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }.god-hero-art { height:clamp(520px,65vw,730px); max-height:78vh; overflow:hidden; position:relative; }.god-hero-art img { width:100%; height:100%; object-fit:cover; filter:saturate(.85) contrast(.95); }.god-hero-art:after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(24,45,50,.08),transparent 40%,rgba(24,45,50,.34)); }.god-sun { position:absolute; z-index:2; width:110px; aspect-ratio:1; top:13%; right:13%; border-radius:50%; background:#f5dfa0; box-shadow:0 0 70px #f5dfa099; }.god-orbit { position:absolute; z-index:2; width:75%; height:39%; top:9%; left:10%; border:1px solid rgba(255,248,213,.72); border-radius:50%; transform:rotate(-19deg) skewX(-10deg); }.god-art-caption { position:absolute; z-index:3; left:24px; bottom:25px; color:#fff7de; font:italic 17px/1.15 'Fraunces',serif; }.god-hero-foot { position:absolute; bottom:28px; left:5vw; right:5vw; display:flex; justify-content:space-between; color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }
                .god-section-label { color:var(--god-accent); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }.god-section-label > span { margin-right:12px; color:var(--god-ink); }.god-word { padding:17vh 5vw; border-bottom:1px solid var(--god-line); }.god-word-grid { display:grid; grid-template-columns:1fr 1fr; gap:11vw; margin-top:68px; }.god-word h2,.god-poem h2,.god-letter h2 { margin:0; font:600 clamp(58px,7.4vw,104px)/.84 'Fraunces',serif; letter-spacing:-.085em; }.god-word h2 em,.god-poem h2 em,.god-letter h2 em,.god-closing h2 em { color:var(--god-accent); font-style:italic; }.god-scripture { margin-top:73px; padding-top:23px; border-top:1px solid var(--god-line); max-width:280px; position:relative; }.god-scripture > span { position:absolute; top:-23px; left:-4px; color:var(--god-accent); font:75px/.7 Georgia,serif; }.god-scripture p { margin:0; font:italic 20px/1.25 'Fraunces',serif; }.god-scripture small { display:block; margin-top:18px; color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; }.god-word-body { align-self:end; max-width:430px; color:#596668; font:16px/1.85 Georgia,serif; }.god-lede { color:var(--god-ink); font-size:22px; line-height:1.45; }.god-rule { display:flex; align-items:center; gap:15px; margin-top:52px; color:var(--god-accent); }.god-rule:before,.god-rule:after { content:''; flex:1; border-top:1px solid var(--god-line); }.god-rule small { font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }
                .god-verse-field { padding:15vh 12vw; background:#203d42; color:#f4eee0; border-bottom:1px solid var(--god-line); }.god-verse-heading,.god-verse-foot { display:flex; justify-content:space-between; align-items:center; }.god-verse-heading .god-section-label { color:#d7b886; }.god-verse-heading .god-section-label > span { color:#f4eee0; }.god-verse-symbol { color:#d7b886; font-size:33px; }.god-verse-lines { margin:85px auto; max-width:730px; }.god-verse-line { margin:0 0 8px; font:500 clamp(29px,4.3vw,61px)/1.05 'Fraunces',serif; letter-spacing:-.06em; }.god-verse-indent { padding-left:11vw; color:#d7b886; }.god-verse-foot { color:#a9b9b4; font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }.god-verse-foot span:nth-child(2) { color:#d7b886; font-size:17px; }
                .god-poem { padding:17vh 5vw; border-bottom:1px solid var(--god-line); }.god-poem-layout { display:grid; grid-template-columns:1fr 1fr; gap:10vw; margin-top:62px; }.god-poem-image { height:clamp(450px,55vw,650px); position:relative; overflow:hidden; }.god-poem-image img { width:100%; height:100%; display:block; object-fit:cover; }.god-poem-image:after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 48%,rgba(24,45,50,.54)); }.god-poem-image span { position:absolute; z-index:1; left:22px; bottom:25px; color:#fff5d8; font:italic 24px/1.04 'Fraunces',serif; }.god-poem-copy { align-self:center; }.god-poem-copy h2 { font-size:clamp(52px,6vw,87px); }.god-poem-text { margin:51px 0 0 4vw; color:#596668; font:20px/1.35 Georgia,serif; }.god-poem-text p { margin:0 0 23px; }.god-poem-signature { color:var(--god-accent); font:13px/1.5 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }.god-poem-signature strong { font:italic 20px 'Fraunces',serif; text-transform:none; letter-spacing:0; }.god-quote { padding:17vh 8vw; text-align:center; border-bottom:1px solid var(--god-line); }.god-quote-mark { color:var(--god-accent); display:block; font:170px/.35 Georgia,serif; }.god-quote p { max-width:850px; margin:0 auto; font:600 clamp(40px,5.6vw,80px)/.93 'Fraunces',serif; letter-spacing:-.075em; }
                .god-letter { padding:17vh 5vw; border-bottom:1px solid var(--god-line); }.god-letter-layout { display:grid; grid-template-columns:1fr 1fr; gap:10vw; margin-top:64px; }.god-letter-heading { position:relative; }.god-letter-heading h2 { font-size:clamp(62px,8vw,108px); }.god-letter-flourish { position:absolute; bottom:4%; left:50%; color:var(--god-accent); font-size:75px; transform:rotate(-15deg); }.god-letter-copy { max-width:445px; color:#596668; font:16px/1.85 Georgia,serif; }.god-letter-copy p:first-child { color:var(--god-ink); font-size:22px; line-height:1.45; }.god-letter-ending { color:var(--god-ink); font-style:italic; }.god-hand-signoff { margin-top:44px; color:var(--god-accent); font:29px/1.05 'Fraunces',serif; }.god-hand-signoff em { font-size:49px; }.god-prayer { padding:16vh 5vw; background:#e5d7be; }.god-prayer-card { max-width:710px; margin:auto; padding:7vw; position:relative; background:var(--god-paper); box-shadow:0 18px 50px rgba(41,50,43,.12); }.god-prayer-cross { display:block; margin:41px 0 20px; color:var(--god-accent); font-size:33px; }.god-prayer-card p { margin:0 0 25px; font:500 clamp(27px,4vw,49px)/1.02 'Fraunces',serif; letter-spacing:-.05em; }.god-amen { display:block; margin-top:52px; color:var(--god-accent); font:italic 28px 'Fraunces',serif; }.god-closing { padding:19vh 5vw; text-align:center; }.god-closing .god-rule { max-width:450px; margin:0 auto 65px; }.god-closing h2 { margin:0; font:600 clamp(67px,9vw,125px)/.82 'Fraunces',serif; letter-spacing:-.09em; }.god-closing p { margin:42px auto 0; color:var(--god-soft); font:italic 21px/1.4 'Fraunces',serif; }.god-closing-mark { margin-top:55px; color:var(--god-accent); font-size:30px; }.god-closing small { display:block; margin-top:38px; color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }.god-footer { display:flex; justify-content:space-between; padding:23px 5vw; border-top:1px solid var(--god-line); color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }
                @media (max-width:760px) { .god-nav { padding:20px 18px; }.god-nav nav { display:none; }.god-nav-meta { font-size:8px; }.god-hero { min-height:auto; padding:75px 18px 75px; display:flex; flex-direction:column; align-items:stretch; }.god-hero-copy { order:1; }.god-hero-art { order:2; height:510px; max-height:none; margin-top:58px; }.god-hero-foot { position:relative; order:3; inset:auto; margin-top:34px; }.god-word,.god-poem,.god-letter { padding:100px 18px; }.god-word-grid,.god-poem-layout,.god-letter-layout { display:block; }.god-word-body,.god-letter-copy { margin-top:65px; }.god-scripture { margin-top:60px; }.god-verse-field { padding:100px 25px; }.god-verse-lines { margin:65px 0; }.god-verse-line { font-size:31px; }.god-verse-indent { padding-left:9vw; }.god-verse-foot span:first-child { max-width:120px; }.god-poem-image { height:490px; }.god-poem-copy { margin-top:72px; }.god-poem-text { margin:45px 0 0 8vw; font-size:18px; }.god-quote { padding:100px 20px; }.god-quote p { font-size:44px; }.god-letter-heading { min-height:250px; }.god-letter-flourish { bottom:-15%; left:64%; }.god-prayer { padding:80px 18px; }.god-prayer-card { padding:54px 28px; }.god-footer { padding:20px 18px; font-size:8px; }.god-footer span:nth-child(2) { max-width:90px; text-align:center; } }
            `}</style>
        </div>
    )
}
