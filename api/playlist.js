// Función de Vercel: lee una lista de reproducción PÚBLICA de YouTube y la
// devuelve en JSON para que la web la muestre sola.
// Uso: /api/playlist?id=PLYY4F6Uosy4I
// No necesita claves: usa el feed público de YouTube (trae los ~15 videos
// más recientes de la lista). Las listas privadas no se pueden leer.

const ID_VALIDO = /^[A-Za-z0-9_-]{10,64}$/;

function texto(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function primero(re, s) {
  const m = s.match(re);
  return m ? m[1] : "";
}

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "");
  if (!ID_VALIDO.test(id)) {
    res.status(400).json({ error: "Código de lista no válido" });
    return;
  }
  try {
    const r = await fetch(
      "https://www.youtube.com/feeds/videos.xml?playlist_id=" + encodeURIComponent(id),
      { headers: { "User-Agent": "Mozilla/5.0 (DYWOX web)" } }
    );
    if (!r.ok) {
      // 404 = la lista no existe o es privada
      res.status(r.status === 404 ? 404 : 502).json({ error: "YouTube respondió " + r.status });
      return;
    }
    const xml = await r.text();
    const nombre = texto(primero(/<title>([^<]*)<\/title>/, xml));
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
      id: primero(/<yt:videoId>([^<]+)<\/yt:videoId>/, e),
      titulo: texto(primero(/<title>([^<]*)<\/title>/, e)),
      fecha: primero(/<published>([^<]+)<\/published>/, e),
      vistas: Number(primero(/views="(\d+)"/, e) || 0),
    })).filter(v => v.id);
    // Vercel guarda la respuesta 10 minutos: la web es rápida y no molesta a YouTube
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    res.status(200).json({ id, nombre, videos });
  } catch (e) {
    res.status(502).json({ error: "No se pudo leer YouTube" });
  }
};
