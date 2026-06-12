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

/* contact form -> open the user's email client with details pre-filled */
function sendContactEmail(e){
  e.preventDefault();
  const form = e.target;
  const val = name => (form.elements[name] && form.elements[name].value.trim()) || '';

  const fname = val('First Name');
  const lname = val('Last Name');
  const email = val('Email');
  const phone = val('Phone');
  const website = val('Website');
  const role = val('Role');
  const message = val('Message');

  const subject = `Enquiry from AT-IPIC website - ${fname} ${lname}`.trim();
  let body = `Name: ${fname} ${lname}\nEmail: ${email}\n`;
  if(phone) body += `Phone: ${phone}\n`;
  if(website) body += `Website: ${website}\n`;
  if(role) body += `Role: ${role}\n`;
  body += `\nMessage:\n${message}`;

  window.location.href = `mailto:Adrian.Clements@atipicgroup.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
