/* shared nav scroll + mobile + fade-in */
(function(){
  const nav = document.getElementById('sitenav');
  if(nav){
    function checkScroll(){ nav.classList.toggle('on-light', window.scrollY > 70); }
    window.addEventListener('scroll', checkScroll, {passive:true});
    checkScroll();
  }
  // mobile
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');
  const close  = document.getElementById('drawerClose');
  if(burger && drawer){
    burger.addEventListener('click', ()=>{ drawer.classList.add('open'); document.body.style.overflow='hidden'; });
    if(close) close.addEventListener('click', ()=>{ drawer.classList.remove('open'); document.body.style.overflow=''; });
    drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ drawer.classList.remove('open'); document.body.style.overflow=''; }));
  }
  // fade-in observer
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('vis'); });
  },{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.fi').forEach(el=>obs.observe(el));
  // smooth scroll anchors
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const t=document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}
    });
  });
})();
