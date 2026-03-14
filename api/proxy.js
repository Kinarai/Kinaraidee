/**
 * ไฟล์ Backend (Serverless Function) สำหรับ Vercel
 * อัปเดต: สั่ง AI ให้ "ห้ามเพิ่มวัตถุดิบหลัก" เด็ดขาด บังคับให้ใช้แค่ของที่มีในตู้เย็น + เครื่องปรุงพื้นฐาน
 */

module.exports = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในหน้า Settings ของ Vercel" });
  }

  const { task, ingredients, prompt } = req.body;

  try {
    if (task === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      // ✅ 1. เปลี่ยนคำสั่งฝั่งผู้ใช้ให้เน้นย้ำว่า "มีแค่นี้จริงๆ"
      const userQuery = `ฉันมีวัตถุดิบในตู้เย็นแค่นี้: "${ingredients}" ช่วยคิดเมนูอาหาร 10 เมนูจากวัตถุดิบเหล่านี้เท่านั้น`;
      
      // ✅ 2. ใส่ "กฎเหล็ก (Strict Rules)" ให้ AI ทำตามอย่างเคร่งครัด
      const systemPrompt = `คุณคือเชฟมืออาชีพที่เก่งการทำอาหารจากของเหลือในตู้เย็น (Pantry Chef)
กฎเหล็กที่คุณต้องทำตามอย่างเคร่งครัดที่สุด (STRICT RULES):
1. ข้อจำกัดวัตถุดิบหลัก: "ห้าม" เพิ่มเนื้อสัตว์, ผัก, สมุนไพร หรือเส้นอื่นๆ นอกเหนือจากที่ผู้ใช้ระบุมาเด็ดขาด ต้องใช้แค่สิ่งที่ให้มาเท่านั้น (เช่น ถ้าผู้ใช้ให้มาแค่ "กุ้งสด, เห็ดเข็มทอง, แครอท" ห้ามใส่ ข่า ตะไคร้ ใบมะกรูด ผักชี หมูสับ หรือเส้นก๋วยเตี๋ยว เพิ่มเข้ามาเด็ดขาด)
2. เครื่องปรุงที่อนุญาต: อนุญาตให้ใช้แค่เครื่องปรุงและของแห้งพื้นฐานคู่ครัวเท่านั้น ได้แก่ (น้ำมันพืช, เกลือ, น้ำตาล, น้ำปลา, ซีอิ๊วขาว, ซอสหอยนางรม, กระเทียม, พริกสด, พริกไทย, น้ำเปล่า, มะนาว)
3. การตั้งชื่อเมนู: หากวัตถุดิบน้อยมาก ให้คิดเมนูประยุกต์ที่เรียบง่ายแต่ทำได้จริงด้วยของแค่นั้น
4. Affiliate: แนะนำสินค้าเครื่องปรุงที่เป็นตัวช่วยให้เมนูนี้อร่อยขึ้น 1 อย่าง (เช่น ซอสปรุงรส, ผงปรุงรส) ในฟิลด์ recommended_product
ตอบเป็น JSON เท่านั้น โครงสร้าง: { "recipes": [{ "name", "description", "ingredients": ["กุ้งสด", "แครอท", "น้ำปลา (เครื่องปรุงพื้นฐาน)"], "instructions": [], "difficulty", "time", "english_image_prompt", "recommended_product", "affiliate_hint" }] }`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          // ✅ 3. ลด Temperature ลงจาก 0.7 เหลือ 0.4 เพื่อลดความฟุ้งซ่านของ AI ให้เน้นทำตามกฎมากขึ้น
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
        })
      });

      const data = await response.json();
      
      if (data.error) {
         throw new Error(`Google API Error: ${data.error.message}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return res.status(200).json(JSON.parse(text));

    } else if (task === 'imagen') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: prompt }],
          parameters: { sampleCount: 1 }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(`Imagen API Error: ${data.error.message}`);
      
      const base64 = data.predictions?.[0]?.bytesBase64Encoded;
      return res.status(200).json({ image: `data:image/png;base64,${base64}` });
    }

    return res.status(400).json({ error: "ส่งคำสั่ง task ไม่ถูกต้อง" });

  } catch (error) {
    console.error("Proxy Error:", error.message);
    return res.status(500).json({ error: error.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" });
  }
};