// api/search-ads.js

export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "NIL AD Rolodex API is alive ✅",
    method: req.method,
  });
}