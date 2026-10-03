// Runs before the 3D bundle: pick a page background close to what the scene will show,
// so opening a tab at night doesn't flash a light wall (and vice versa).
const h = new Date().getHours();
const bg = h >= 7 && h < 18 ? '#e3d7c1' : h >= 18 && h < 19.5 ? '#9a7466' : '#2a2430';
document.documentElement.style.setProperty('--boot-bg', bg);
