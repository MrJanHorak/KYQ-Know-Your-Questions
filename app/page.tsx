import { ArrowDown, ArrowRight, ArrowUp, Code2, Link2, LockKeyhole, MessageCircle, Plus, Sparkles, UsersRound } from 'lucide-react';

export default function Page() {
  return <>
    <header className='topbar'>
      <div className='top-inner'>
        <a href='/' className='brand'><span className='brand-mark'><Code2 size={20}/></span><span>KYQ <small> / KNOW YOUR QUESTIONS</small></span></a>
        <div className='top-right'><a className='landing-nav' href='/admin'>Instructor sign in <ArrowRight size={14}/></a><span className='course-pill'>THE QUESTION PORTAL <span>↗</span></span></div>
      </div>
    </header>
    <main className='page landing-page'>
      <section className='hero'>
        <div>
          <div className='eyebrow'><span className='eyebrow-dot'/> A LITTLE SPACE FOR BIG QUESTIONS</div>
          <h1>Good questions<br/><em>drive great</em> outcomes<span className='period'>.</span></h1>
          <p>Give curiosity a place to grow. Bring your group together to ask, share, and learn from one another.</p>
          <a href='#get-started' className='hero-link'>LET’S GET STARTED <ArrowDown size={14}/></a>
        </div>
        <div className='hero-art' aria-hidden='true'>
          <div className='orbit orbit-one'/><div className='orbit orbit-two'/><div className='art-star'>✳</div>
          <div className='art-card'><div className='art-top'><span>THE LEARNING LOOP</span><Sparkles size={16}/></div><div className='art-symbol'>?</div><div className='art-bottom'><span>ASK MORE.<br/>BUILD BETTER.</span><span>↗</span></div></div>
          <span className='art-caption'>CURIOSITY IS A SUPERPOWER ✳</span>
        </div>
      </section>
      <div className='ticker'><span>✳ &nbsp; ASK BOLDLY</span><span>✳ &nbsp; LEARN TOGETHER</span><span>✳ &nbsp; NO QUESTION TOO SMALL</span><span>✳ &nbsp; KEEP BUILDING</span></div>
      <div className='workspace landing-workspace' id='get-started'>
        <section className='main-column' aria-labelledby='landing-heading'>
          <div className='section-head'><div><span className='eyebrow'>THE CONVERSATION <span className='eyebrow-slash'>/</span> EVERYONE HAS A QUESTION</span><h2 id='landing-heading'>Make room for curiosity<span className='period'>.</span></h2><p>A welcoming space for the questions that move learning forward.</p></div></div>
          <div className='landing-example-label'><span className='green-dot'/> A PEEK INSIDE A BOARD <span>EXAMPLE</span></div>
          <div className='landing-examples'>
            <article className='question-card landing-example'><div className='vote' aria-hidden='true'><ArrowUp size={19}/><strong>8</strong></div><div className='question-content'><div className='question-meta'><span className='status'>● &nbsp; OPEN</span><span>·</span><span>A question from your group</span></div><div className='landing-example-title'>What’s one thing we can try differently?</div><div className='question-bottom'><span><span className='avatar'>A</span> Anonymous</span><span><MessageCircle size={15}/> 3 replies</span></div></div></article>
            <article className='question-card landing-example'><div className='vote' aria-hidden='true'><ArrowUp size={19}/><strong>5</strong></div><div className='question-content'><div className='question-meta'><span className='status answered'>● &nbsp; ANSWERED</span><span>·</span><span>Learning together</span></div><div className='landing-example-title'>Can we go over that last idea again?</div><div className='question-bottom'><span><span className='avatar'>A</span> Anonymous</span><span><MessageCircle size={15}/> 2 replies</span></div></div></article>
          </div>
          <div className='landing-participant'><div className='landing-participant-icon'><Link2 size={18}/></div><div><strong>Joining a board?</strong><p>Open the board link from your instructor and enter the shared password. No account needed.</p></div></div>
        </section>
        <aside>
          <div className='ask-card landing-cta'><div className='ask-icon'><Plus size={22}/></div><span className='eyebrow'>FOR INSTRUCTORS</span><h2>Start a conversation<span className='period'>.</span></h2><p>Create a private board for your class or group, then invite everyone in.</p><a className='primary' href='/admin'>Go to instructor dashboard <ArrowRight size={17}/></a><div className='form-foot'><LockKeyhole size={13}/> INSTRUCTOR PASSWORD REQUIRED</div></div>
          <div className='aside-note'><span>✳</span><div><strong>Better together</strong><p>Collect questions, share answers, and see what your group wants to explore.</p></div></div>
          <div className='aside-bottom'>MADE FOR CURIOUS MINDS <UsersRound size={14}/></div>
        </aside>
      </div>
    </main>
    <footer><div><span>KYQ<span className='period'>.</span></span><p>Better questions. Better builders.</p></div><span>QUESTION EVERYTHING &nbsp; ✳ &nbsp; KEEP CURIOUS</span></footer>
  </>;
}
