/* byformain — lógica pura de Speaking / shadowing / dictado (sin DOM): textos propios y puntuación de coincidencia. */
(function (root) {
  'use strict';
  const LEVELS = ['A2', 'B1', 'B2', 'C1'];
  const MODES = [['hablar', 'Hablar'], ['shadowing', 'Shadowing'], ['dictado', 'Dictado']];
  const CATS = [['mixto', 'Mixto'], ['tema', 'Temas'], ['situacion', 'Situaciones'], ['dia', 'Mi día'], ['opinion', 'Opiniones']];
  const DURS = [[60, '1 min'], [120, '2 min'], [180, '3 min']];
  const modeLabel = (m) => (MODES.find((x) => x[0] === m) || MODES[0])[1];
  const catLabel = (c) => (CATS.find((x) => x[0] === c) || CATS[0])[1];

  /* [pregunta en inglés, pista en español, respuesta modelo] */
  const TALK = {
    tema: {
      A2: [
        ['Talk about your family. Who is in your family and what do they do?', 'Usa el presente simple: My mother works…', 'There are four people in my family: my parents, my brother and me. My mother is a nurse and my father works in a bank. My brother is at university. We usually have dinner together on Sundays.'],
        ['Describe your house or flat. What rooms does it have?', 'There is / There are + habitaciones.', 'I live in a small flat in the city centre. It has two bedrooms, a kitchen and a living room. My favourite room is the living room because it is bright. I would like a bigger balcony.'],
        ['What is your favourite food and why do you like it?', 'Because + razón.', 'My favourite food is paella. I like it because it is tasty and it reminds me of my family. My grandmother makes the best paella. I eat it almost every Sunday.'],
      ],
      B1: [
        ['Tell me about a place you would like to visit and explain why.', 'Would like to + verbo; because / so.', 'I would really like to visit Japan. I am interested in the culture and the food, and I have heard that the cities are very clean and safe. I would go in spring to see the cherry blossoms. I think it would be an unforgettable trip.'],
        ['Describe a good friend of yours. What is he or she like?', 'Adjetivos de personalidad: kind, funny, loyal…', 'My best friend is called Laura. She is very funny and generous, and she always listens when I have a problem. We met at school ten years ago and we still see each other every week. I feel lucky to have her.'],
        ['What do you do in your free time? How did you start doing it?', 'Presente simple + pasado simple para el origen.', 'In my free time I like cycling and reading. I started cycling when my father gave me a bike for my twelfth birthday. Now I go out almost every weekend with some friends. It helps me relax after a long week.'],
      ],
      B2: [
        ['How has technology changed the way we study or work in the last ten years?', 'Present perfect: has made it easier…', 'Technology has transformed the way we work and study. We can now attend classes or meetings from anywhere, which saves a lot of time. On the other hand, it has become harder to switch off, because we are always connected. Overall, I think the benefits outweigh the drawbacks, as long as we set clear limits.'],
        ['Describe a skill you would like to learn and explain how you would go about learning it.', 'If I were to… / I would start by…', 'I would love to learn how to play the piano. I would start by taking a few lessons with a good teacher so that I do not pick up bad habits. Then I would practise for twenty minutes every day, because regular practice is more effective than long, occasional sessions. It would take years, but I would enjoy the process.'],
        ['Talk about a challenge you have overcome and what you learned from it.', 'Relata en pasado y cierra con una reflexión.', 'A few years ago I had to give a presentation in English in front of a hundred people. I was terrified, so I rehearsed for weeks and asked my friends for feedback. In the end it went much better than I expected. It taught me that preparation is the best cure for nerves.'],
      ],
      C1: [
        ['To what extent does the place where you grow up shape the person you become?', 'Matiza: to a large extent, up to a point…', 'To a large extent, I would say. The environment we grow up in influences our values, our accent and even our ambitions. That said, it is not deterministic: people who move away often reinvent themselves completely. Ultimately, I think it is the interaction between place and personal choice that matters.'],
        ['Discuss the advantages and drawbacks of living in a very big city.', 'On the one hand… on the other hand…', 'On the one hand, big cities offer an enormous range of jobs, cultural activities and services. On the other hand, they tend to be expensive, noisy and stressful. Personally, I think the ideal compromise is to live near a big city but not in the middle of it, so you can enjoy the opportunities without the constant pressure.'],
        ['What role should art and culture play in a modern society?', 'Argumenta con ejemplos y concesiones.', 'Art and culture are far more than entertainment; they help us understand other perspectives and question our own assumptions. Societies that invest in them tend to be more open and creative. Although funding is always limited, I would argue that cutting the cultural budget is a false economy, since its benefits are long term and hard to measure.'],
      ],
    },
    situacion: {
      A2: [
        ['You are in a café. Order a coffee and something to eat, and ask for the bill.', 'Can I have…? / How much is it?', 'Hello, can I have a coffee with milk, please? And a slice of chocolate cake. Thank you. Excuse me, could I have the bill, please? How much is it?'],
        ['You are lost in a new city. Ask a stranger how to get to the train station.', 'Excuse me… Where is…? Is it far?', 'Excuse me, I am lost. Could you tell me how to get to the train station, please? Is it far from here? Do I turn left or right at the traffic lights? Thank you very much for your help.'],
        ['Introduce yourself to a new classmate. Say where you are from and what you like.', 'My name is… I am from… I like…', 'Hi, my name is Daniel and I am from Seville. I am twenty-two years old. I like football, music and watching films. What about you? Where are you from?'],
      ],
      B1: [
        ['You booked a hotel room, but the room is very noisy. Explain the problem and ask for another room.', 'I am afraid… Would it be possible to…?', 'Good evening. I am afraid there is a problem with my room. It is facing the street and it is very noisy, so I cannot sleep. Would it be possible to move to a quieter room, perhaps at the back of the hotel? I would really appreciate it.'],
        ['Call a doctor\'s office to make an appointment. Say what is wrong and when you are free.', 'I have had… since… / I am free on…', 'Hello, I would like to make an appointment, please. I have had a sore throat and a fever since Sunday, and I am not feeling any better. I am free on Thursday morning or any time on Friday. Is there anything available?'],
        ['Your flight has been cancelled. Talk to the airline agent and ask for options.', 'Could you tell me what my options are?', 'Excuse me, my flight to Madrid has been cancelled and I need to be there tomorrow morning. Could you tell me what my options are? Is there another flight this evening, or could you book me on the first one tomorrow? Also, will the airline pay for a hotel?'],
      ],
      B2: [
        ['You bought a laptop that stopped working after two weeks. Explain the problem to the shop assistant and say what you want them to do.', 'I would like a refund or a replacement.', 'Hello, I bought this laptop two weeks ago and it has stopped working. It will not turn on at all, even when it is plugged in. I have brought the receipt with me. I would like either a full refund or a replacement, whichever is easier for you.'],
        ['In a job interview, you are asked: Why should we hire you? Give a convincing answer.', 'Experiencia + cualidades + beneficio para la empresa.', 'I believe I am a good fit for this role for three reasons. First, I have five years of experience in similar projects. Second, I work well in teams and I am used to meeting tight deadlines. Finally, I am eager to learn, so I would bring fresh ideas and commitment to your company.'],
        ['You disagree with a colleague about how to organise a project. Politely explain your point of view and suggest a compromise.', 'I see your point, but… How about…?', 'I see your point, and I agree that speed is important. However, I am concerned that skipping the testing phase could cause bigger problems later. How about we divide the work into two stages, so that we deliver a first version quickly and then test it properly before the final release?'],
      ],
      C1: [
        ['You are chairing a meeting and two team members are arguing. Calm the situation and steer the discussion back to the agenda.', 'Let me step in here… Let\'s park that for now.', 'Let me step in for a moment. I can see that you both feel strongly about this, and those are valid concerns. Let us park that issue for now and come back to it at the end if we have time. For now, I would like us to focus on the next item on the agenda: the budget for the second quarter.'],
        ['Negotiate a deadline extension with a client who is unhappy about the delay.', 'Reconoce el problema y ofrece una solución realista.', 'I completely understand your frustration, and I apologise for the delay. The reason is that the specifications changed twice during the project. If we could extend the deadline by one week, we would be able to deliver a much more reliable product. In return, I would be happy to include a free month of support.'],
        ['Give a short farewell speech to a colleague who is leaving the company after many years.', 'Agradecimiento, anécdota y buenos deseos.', 'It is hard to believe that after twelve years we are saying goodbye to Maria. She has been a mentor and a friend to so many of us, and her calm approach has got us through some very difficult moments. I will never forget the time she saved a project with one phone call. On behalf of everyone here, thank you, and the very best of luck in the next chapter.'],
      ],
    },
    dia: {
      A2: [
        ['Describe your morning. What do you do from the moment you wake up?', 'First, then, after that…', 'I wake up at seven o\'clock. First I take a shower and get dressed. Then I have breakfast with a coffee and some toast. After that I brush my teeth and leave the house at eight.'],
        ['What did you do yesterday? Say at least five things.', 'Pasado simple: I went, I had, I watched…', 'Yesterday I got up late because it was Saturday. I had breakfast and then I went shopping with my sister. In the afternoon I watched a film at home. In the evening I cooked dinner and called my grandmother.'],
        ['Describe a typical weekend day.', 'Usually, sometimes, in the afternoon…', 'On Saturdays I usually sleep until nine. In the morning I clean the flat and go to the market. In the afternoon I meet my friends for a coffee. In the evening we sometimes go to the cinema.'],
      ],
      B1: [
        ['Describe your day yesterday from morning to night, using past tenses and linking words.', 'After that, while, by the time…', 'Yesterday I woke up early because I had an important meeting. While I was having breakfast, I checked my emails. After the meeting I had lunch with a colleague and then I worked until six. In the evening I went to the gym, and by the time I got home I was exhausted.'],
        ['Tell me about your daily routine and say which part of the day you enjoy most.', 'What I enjoy most is…', 'I get up at seven, go to work by metro and finish at five. I enjoy the evenings most, because I can relax, cook something nice and watch a series. In the mornings I am usually in a hurry, so I do not have much time for myself.'],
        ['What are you going to do tomorrow? Describe your plans in detail.', 'I\'m going to… I\'m meeting…', 'Tomorrow I am going to get up early and go for a run. Then I am meeting a friend for breakfast at ten. In the afternoon I have to finish a report for work. In the evening I am going to cook dinner for my family.'],
      ],
      B2: [
        ['Describe a day that did not go as planned and explain how you dealt with it.', 'Narra en pasado y usa had + participio.', 'Last month I missed my train because the alarm had not gone off. I had to call my boss and explain the situation, and then I took a taxi to the office. Of course, the traffic was terrible. In the end I arrived an hour late, but I managed to catch up by working through lunch.'],
        ['Compare a typical working day with a typical day off.', 'Whereas / while / on the other hand…', 'On a working day I follow a strict routine: I get up at half past six and I am usually at my desk by nine. Whereas on a day off I let myself sleep late and do whatever I feel like. I think the contrast is what makes both days enjoyable.'],
        ['Describe how your daily routine has changed over the past few years.', 'Used to + verbo / Now I…', 'I used to commute for an hour every day, but now I work from home two days a week. That has given me much more time for exercise and cooking. On the other hand, I miss the contact with my colleagues. Overall, I am happier with my current routine.'],
      ],
      C1: [
        ['Walk me through your ideal day, giving reasons for each choice.', 'Describe con matices y justifica cada elección.', 'My ideal day would start slowly, with a long breakfast and no screens, because I find that sets a calm tone for everything else. I would spend the morning on something creative, like writing, as that is when my mind is clearest. After a long lunch with friends, I would go for a walk in the mountains. I would finish the evening cooking and reading, with no obligations.'],
        ['Reflect on how you organise your time and what you would change about it.', 'If I could, I would… I tend to…', 'I tend to plan my week in detail, but in practice I often end up reacting to urgent tasks. If I could change one thing, I would block out time for deep work every morning and switch off my notifications. I am convinced that would make me both more productive and less stressed.'],
        ['Describe a day that you will remember for a long time, as vividly as you can.', 'Detalles sensoriales y emociones.', 'I will never forget the day I reached the top of a mountain after a six-hour climb. The air was thin and cold, my legs were shaking, but when the clouds opened I could see the whole valley beneath me. For a moment nobody said a word. It was one of those rare occasions when effort and reward seem perfectly balanced.'],
      ],
    },
    opinion: {
      A2: [
        ['Do you prefer summer or winter? Why?', 'I prefer… because…', 'I prefer summer because the days are longer and I can go to the beach. I also like wearing light clothes. In winter it is cold and dark, and I do not like that. My favourite month is July.'],
        ['Is it better to live in a city or in a village? Give one or two reasons.', 'I think… In my opinion…', 'I think it is better to live in a city because there are more things to do. You can go to cinemas, restaurants and museums. Also, it is easier to find a job. But villages are quieter and cheaper.'],
        ['Do you like cooking? Why or why not?', 'I (don\'t) like… because it is…', 'Yes, I like cooking because it is relaxing and creative. I usually cook on Sundays for my family. My best dish is pasta with tomato sauce. I do not like washing the dishes afterwards.'],
      ],
      B1: [
        ['Do you think students should wear school uniforms? Give reasons.', 'In my opinion… On the one hand…', 'In my opinion, school uniforms are a good idea. First, they make all students equal, so nobody feels bad about their clothes. Second, they save time in the morning. However, I understand that some students want to express their personality through what they wear.'],
        ['Is social media good or bad for young people? What do you think?', 'It depends on… The main problem is…', 'I think it depends on how people use it. Social media helps young people to keep in touch with friends and to learn new things. However, the main problem is that many of them spend too many hours online and compare themselves with others. In my view, the key is to use it in moderation.'],
        ['Should people work from home more often? Say what you think.', 'Advantages and disadvantages.', 'I believe that working from home has more advantages than disadvantages. You save time and money on transport, and you can organise your day more freely. The main disadvantage is that you can feel isolated. A good solution would be to combine two days at home with three days in the office.'],
      ],
      B2: [
        ['Some people say money cannot buy happiness. To what extent do you agree?', 'To a certain extent / Having said that…', 'To a certain extent, I agree. Money can certainly remove many sources of stress, such as debts or job insecurity, and that contributes to well-being. Having said that, once our basic needs are covered, additional wealth does not make us much happier. Relationships and a sense of purpose seem to matter far more.'],
        ['Should governments ban single-use plastics? Give arguments for your opinion.', 'Argumentos a favor y objeciones.', 'I strongly believe they should. Single-use plastics are used for a few minutes but pollute for hundreds of years, and our oceans are already full of them. Some argue that a ban would harm businesses, but there are plenty of alternatives such as paper, glass or reusable containers. Therefore, I think the benefits clearly outweigh the costs.'],
        ['Is it better to study abroad or in your own country? Compare both options.', 'Compared with… whereas…', 'Studying abroad offers a unique opportunity to learn a language and to become more independent. However, it can be expensive and you may feel homesick. Studying in your own country is cheaper and you stay close to your family, whereas you miss the international experience. If I had the chance, I would spend at least one year abroad.'],
      ],
      C1: [
        ['Is it ethical for companies to use artificial intelligence to replace human workers?', 'Presenta ambos lados antes de concluir.', 'It is a complex question. On the one hand, companies have a duty to stay competitive, and automation can free people from repetitive tasks. On the other hand, it would be irresponsible to let thousands of workers lose their livelihoods without any support. In my view, the ethical approach is to combine innovation with retraining programmes and a fair transition.'],
        ['Do you believe that fame and social media have made people less authentic?', 'Matiza: not necessarily, up to a point…', 'Up to a point, yes. When people are constantly aware of an audience, they tend to curate an image rather than show who they really are. However, I would not say that authenticity has disappeared; some creators are remarkably honest. What has changed is that the pressure to perform is now much harder to escape.'],
        ['Should higher education be free for everyone? Weigh up the arguments.', 'Weigh up: pros, cons, conclusion.', 'The case for free higher education is compelling: it promotes equal opportunities and benefits society as a whole. Critics, however, point out that it places a heavy burden on public finances and does not necessarily improve quality. A reasonable middle ground might be free tuition combined with selective entry or income-based contributions after graduation.'],
      ],
    },
  };

  const SENTENCES = {
    A2: ['I usually get up at seven and have breakfast with my family.', 'Could you tell me where the nearest bank is, please?', 'My brother plays football every Saturday morning.', 'We are going to the beach with some friends tomorrow.', 'It was raining, so we stayed at home and watched a film.', 'I would like a coffee with milk and a piece of cake.', 'She has worked in this hospital for three years.', 'Do you want to have dinner with us tonight?', 'The train to Madrid leaves at half past nine.', 'I do not speak English very well, but I am learning.', 'There are two bedrooms and a small kitchen in my flat.', 'He bought a new phone because the old one was broken.'],
    B1: ['If I had more free time, I would spend it travelling around Europe.', 'I have been learning English for two years and I am starting to feel more confident.', 'The meeting was postponed because the manager was ill.', 'She told me that she was going to move to another city next month.', 'Although it was expensive, we decided to book a room with a sea view.', 'I am looking forward to seeing you again at the weekend.', 'You should not drive so fast when the road is wet.', 'By the time we arrived, the film had already started.', 'He used to play the guitar in a band when he was a teenager.', 'Would you mind opening the window? It is very hot in here.', 'The more I practise, the easier it becomes to speak fluently.', 'We have lived in this neighbourhood since I was a child.'],
    B2: ['Had I known about the delay, I would have taken a different flight.', 'The company has been struggling to attract skilled workers over the past decade.', 'Not only did she finish the project on time, but she also stayed under budget.', 'I would rather you told me the truth than keep making excuses.', 'Despite the heavy traffic, we managed to get to the airport in time.', 'It is high time that governments took serious action against climate change.', 'He admitted having made a mistake and promised it would not happen again.', 'Whatever you decide, I will support you one hundred per cent.', 'The results were far better than anyone had expected.', 'She is said to be one of the most influential architects of her generation.', 'If it were not for your advice, I would never have applied for this position.', 'The proposal was rejected on the grounds that it was too expensive.'],
    C1: ['Hardly had the conference begun when the projector stopped working.', 'The extent to which social media shapes public opinion is a matter of ongoing debate.', 'Were it not for the generous support of our sponsors, the festival would have been cancelled.', 'It would be naive to assume that technology alone can solve these problems.', 'Having weighed up the pros and cons, they decided to postpone the decision.', 'Rarely do we see such a remarkable combination of talent and determination.', 'The negotiations broke down because neither side was willing to compromise.', 'Little did she realise that her decision would change the course of her career.', 'The report highlights a growing gap between rhetoric and reality.', 'No sooner had we settled in than the neighbours began complaining about the noise.', 'Whether or not the plan succeeds depends largely on how well we communicate.', 'It goes without saying that the quality of the product is our top priority.'],
  };

  /* banco compilado */
  const TALK_LIST = [];
  for (const [cat, byLv] of Object.entries(TALK)) for (const lv of LEVELS) (byLv[lv] || []).forEach((r, i) => TALK_LIST.push({ id: cat.slice(0, 3) + '-' + lv + '-' + (i + 1), cat, lvl: lv, en: r[0], es: r[1], model: r[2] }));
  const SENT_LIST = [];
  for (const lv of LEVELS) SENTENCES[lv].forEach((t, i) => SENT_LIST.push({ id: 'sh-' + lv + '-' + (i + 1), lvl: lv, text: t }));

  function shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const unseenFirst = (list, recent, rnd) => { const s = new Set(recent || []), f = shuffle(list, rnd); return f.filter((x) => !s.has(x.id)).concat(f.filter((x) => s.has(x.id))); };
  function pickPrompt(level, cat, recent, rnd, avoidId) {
    rnd = rnd || Math.random;
    const list = TALK_LIST.filter((x) => x.lvl === level && (cat === 'mixto' || x.cat === cat));
    const o = unseenFirst(list, recent, rnd).filter((x) => x.id !== avoidId);
    return o[0] || list[0];
  }
  function pickSentences(level, n, recent, rnd) { return unseenFirst(SENT_LIST.filter((x) => x.lvl === level), recent, rnd || Math.random).slice(0, n); }

  /* ---------- texto → palabras comparables ---------- */
  const CONTR = { "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is', "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "here's": 'here is', "let's": 'let us', "can't": 'cannot', "won't": 'will not', "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have', "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "he'll": 'he will', "she'll": 'she will', "i'd": 'i would', "you'd": 'you would' };
  function tokens(text) {
    const out = [];
    for (let w of String(text == null ? '' : text).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[-–—]/g, ' ').split(/\s+/)) {
      w = w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''); if (!w) continue;
      let e = CONTR[w] || (/n't$/.test(w) ? w.replace(/n't$/, ' not') : w);
      if (w === "isn't" || w === "aren't" || w === "don't" || w === "doesn't" || w === "didn't" || w === "wasn't" || w === "weren't" || w === "haven't" || w === "hasn't" || w === "hadn't" || w === "wouldn't" || w === "shouldn't" || w === "couldn't" || w === "mustn't") e = w.replace(/n't$/, '') + ' not';
      if (w === "don't") e = 'do not';
      for (const p of e.split(' ')) if (p) out.push(p);
    }
    return out;
  }
  const wordCount = (text) => String(text || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

  /* Compara lo dicho con la frase objetivo (alineación por subsecuencia común más larga).
     Devuelve { pct, ok, total, words: [{w, ok}], extra: [palabras dichas de más] } */
  function scoreShadowing(target, transcript) {
    const disp = String(target || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    const dTok = disp.map((w) => tokens(w));
    const flat = []; dTok.forEach((ts, i) => ts.forEach((t) => flat.push([t, i])));
    const sp = tokens(transcript);
    const n = flat.length, m = sp.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = flat[i][0] === sp[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hit = new Array(n).fill(false), used = new Array(m).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) { if (flat[i][0] === sp[j]) { hit[i] = true; used[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    const okW = disp.map(() => true), has = disp.map(() => false);
    flat.forEach(([, wi], k) => { has[wi] = true; if (!hit[k]) okW[wi] = false; });
    const words = disp.map((w, k) => ({ w, ok: has[k] && okW[k] }));
    const ok = words.filter((x) => x.ok).length;
    return { pct: words.length ? Math.round(ok / words.length * 100) : 0, ok, total: words.length, words, extra: sp.filter((_, k) => !used[k]) };
  }
  const SELF = { 1: 'Muy difícil', 2: 'Con dificultad', 3: 'Aceptable', 4: 'Bien', 5: 'Muy bien' };
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  /* mejor marca de shadowing/dictado por modo y nivel (media de % de sesiones con ≥ n frases) */
  function bestScore(history, mode, level) {
    let b = null; for (const r of history) if (r.mode === mode && r.level === level && r.score != null && r.items >= 3 && (!b || r.score > b.score)) b = r; return b;
  }
  const API = { LEVELS, MODES, CATS, DURS, SELF, TALK_LIST, SENT_LIST, modeLabel, catLabel, tokens, wordCount, scoreShadowing, pickPrompt, pickSentences, avg, bestScore, shuffle };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BFSpeaking = API;
})(typeof self !== 'undefined' ? self : this);
