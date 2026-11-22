// Función de Vercel: busca TODAS las listas de reproducción públicas del canal
// y devuelve sus videos en JSON. Así, una lista nueva aparece sola en la web.
// Uso: /api/canal
// Las listas privadas no se ven. Para ocultar una lista pública (por ejemplo
// GAMES), agrégala en EXCLUIR dentro de index.html.

const CANAL = "@dywox-3";   // tu canal de YouTube
const ENCABEZADOS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "es-PE,es;q=0.9",
  // evita la pantalla de "antes de continuar" de YouTube en algunos países
  "Cookie": "CONSENT=YES+cb; SOCS=CAI",
};

function texto(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function primero(re, s) {
  const m = s.match(re);
  return m ? m[1] : "";
}

async function leerLista(id) {
  const r = await fetch("https://www.youtube.com/feeds/videos.xml?playlist_id=" + id,
                        { headers: ENCABEZADOS });
  if (!r.ok) return null;                       // privada o borrada
  const xml = await r.text();
  return {
    id,
    nombre: texto(primero(/<title>([^<]*)<\/title>/, xml)),
    videos: [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
      id: primero(/<yt:videoId>([^<]+)<\/yt:videoId>/, e),
      titulo: texto(primero(/<title>([^<]*)<\/title>/, e)),
      fecha: primero(/<published>([^<]+)<\/published>/, e),
    })).filter(v => v.id),
  };
}

module.exports = async (req, res) => {
  try {
    const r = await fetch("https://www.youtube.com/" + CANAL + "/playlists", { headers: ENCABEZADOS });
    if (!r.ok) throw new Error("YouTube respondió " + r.status);
    const html = await r.text();
    const ids = [...new Set([...html.matchAll(/"playlistId":"([A-Za-z0-9_-]{10,64})"/g)].map(m => m[1]))];
    if (!ids.length) throw new Error("No se encontraron listas");
    const listas = (await Promise.all(ids.map(id => leerLista(id).catch(() => null))))
      .filter(l => l && l.videos.length);
    // Vercel guarda la respuesta 10 minutos: la web es rápida y no molesta a YouTube
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    res.status(200).json({ canal: CANAL, listas });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
