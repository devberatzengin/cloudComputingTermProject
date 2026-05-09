# Akıllı Veri Yedekleme ve Kurtarma Sistemi

Bu proje, bulut ortamında otomatik yedekleme ve felaket kurtarma hizmeti sunan modern bir web uygulamasıdır.

## Özellikler
- **Otomatik Yedekleme**: Belirlenen aralıklarla verilerin buluta aktarılması.
- **Felaket Kurtarma**: Veri kaybı durumunda hızlı geri yükleme.
- **Versiyon Kontrolü**: S3 Versioning ile geçmiş versiyonlara erişim.
- **Güvenlik**: AES-256 şifreleme ve JWT tabanlı yetkilendirme.
- **Bildirimler**: İşlem durumları hakkında anlık bilgilendirme.

## Teknoloji Yığını
- **Backend**: Python (FastAPI)
- **Frontend**: React (Vite) + TailwindCSS
- **Veritabanı**: MongoDB (Atlas)
- **Bulut Depolama**: AWS S3 (Boto3)

## Kurulum

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows için: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```