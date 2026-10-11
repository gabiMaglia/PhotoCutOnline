// Autoprueba del runner (GROW-35 D-i2-1): termina a los 35 s, más que los 30 s
// por defecto de Playwright y menos que el límite configurado por motor. Solo
// corre con RUNNER_SELFTEST=1; si da TIMEOUT, el runner no está aplicando su límite.
const out = document.getElementById("out");
const t0 = performance.now();
setTimeout(() => {
  out.textContent = `PASS: la página esperó ${Math.round((performance.now() - t0) / 1000)} s\nALL_DONE`;
}, 35_000);
