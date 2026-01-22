function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pl-PL";
  u.rate = 1;   // польский лучше чуть медленнее
  u.pitch = 1.0;

  const pickVoice = () => {
    const voices = speechSynthesis.getVoices();

    const preferred =
      voices.find(v => v.lang === "pl-PL" && v.name.includes("Zosia")) ||
      voices.find(v => v.lang === "pl-PL" && v.name.includes("Ewa")) ||
      voices.find(v => v.lang === "pl-PL" && v.name.includes("Marek")) ||
      voices.find(v => v.lang === "pl-PL");

    if (preferred) {
      u.voice = preferred;
    }

    speechSynthesis.speak(u);
  };

  // iOS: голоса подгружаются асинхронно
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = pickVoice;
  } else {
    pickVoice();
  }
}
