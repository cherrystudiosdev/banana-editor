# Banana Editor

**Open-source editing. Creative freedom.**

Banana Editor; Electron, React, TypeScript ve yerel FFmpeg ile geliştirilen,
çevrimdışı çalışabilen bir masaüstü video düzenleyicisidir. Özgün koyu arayüzü;
medya kitaplığını, kaynak/program monitörlerini, çok kanallı timeline'ı, efekt
kontrollerini ve isteğe bağlı OpenAI/Gemini asistanını bir araya getirir.

[English](README.md) · [Mimari](docs/architecture.md) ·
[Proje biçimi](docs/project-format.md) · [Gizlilik](docs/privacy.md)

## Sürüm durumu ve kullanıcı kurulumu

Geliştirme hedefi **Banana Editor 1.0.0**'dır. Kaynak koddaki sürüm numarası,
kararlı sürümün yayımlandığı anlamına gelmez. Zorunlu kapsam
[release-requirements.md](docs/release-requirements.md), gerçek ilerleme ve test
kanıtları [implementation-status.md](docs/implementation-status.md) içinde izlenir.
Henüz doğrulanmış bir genel installer veya GitHub Release bağlantısı yoktur.

Windows dağıtımı; Electron, FFmpeg/ffprobe, gerekli DLL'ler ve varsayılan fontu
içermelidir. Son kullanıcı Node.js, pnpm, Python veya ayrıca FFmpeg kurmak zorunda
kalmayacaktır. Yayın kapıları geçildiğinde gerçek installer bağlantısı buraya
eklenir. Kaynak kod arşivleri kurulum paketi değildir. Doğrulanmış bir kod imzalama
sertifikası yoktur; imzasız paketler Windows uyarısı oluşturabilir.

Hedef platform Windows 10 **22H2 veya üzeri** ya da Windows 11, x64'tür. Electron
45.1.0 Windows 10+ destekler; seçili FFmpeg paketi 22H2 alt sınırını getirir.
macOS/Linux paketleri doğrulanmamış ve yayımlanmamıştır. Arayüz 1366×768 ve üzeri
ekranları hedefler. Önbellek ve çıktılar için yeterli yerel disk alanı gerekir.

## Geliştirilen bileşenler

- Sürümlü `.banana` proje biçimi, çalışma zamanında doğrulama, atomik kayıt,
  ayrı kurtarma kaydı, son projeler, bağıl medya yolları ve yeniden bağlama.
- Gerçek codec/stream analiziyle video/ses/görsel içe aktarma; metadata, thumbnail,
  ölçülmüş waveform, önizleme proxy'leri, medya klasörleri ve arama.
- Rasyonel FPS ve tamsayı karelerle çok kanallı timeline; bölme, kırpma, ripple,
  taşıma, seçim, pano, linked klipler, kanal kontrolleri, marker ve undo/redo.
- Konum, ölçek, döndürme, crop, opaklık, parlaklık, kontrast, doygunluk, fit/fill,
  fade, cross dissolve, ses seviyesi ve linear/hold keyframe'leri.
- Türkçe karakter destekli başlık ve altyazı klipleri; SRT/WebVTT dönüşümü.
- Tüm katmanları ve ses miksini işleyen gerçek FFmpeg önizleme/export hattı;
  ilerleme, iptal ve geçici çıktı doğrulaması. CPU WebM VP9/Opus ve MP4
  OpenH264/AAC seçenekleri kurulu encoder yetenekleriyle kontrol edilir.
- İsteğe bağlı OpenAI/Gemini adaptörleri; seçili medya hakkında sohbet, özet,
  marker/başlık/kısa kurgu önerisi, incelenebilir düzenleme planı, transkripsiyon,
  altyazı düzeltme ve çeviri.

Bu bileşenlerin tamamı masaüstü, paketlenmiş uygulama ve installer testlerinden
geçmeden kararlı teslimat sayılmaz. [Bilinen sınırları](docs/known-limitations.md)
inceleyin. Program monitörü tüm kompozisyonun oluşturulmuş önbelleğini kullanır;
düzenleme sonrasında eşzamanlı oynatma için önbellek yeniden oluşturulur.

## İlk düzenleme ve export

1. Yeni proje oluşturun; Sequence ayarlarından çözünürlük ve kare hızını seçin.
   Medya içe aktarma bu değerleri kendiliğinden değiştirmez.
2. Dosyaları içe aktarın veya medya kitaplığına bırakın. Kaynağı izleyin; klipleri
   video/ses kanallarına sürükleyin.
3. Klip seçip taşıyın, kırpın, bölün ve Inspector'dan efektleri ayarlayın. Normal
   Delete boşluğu korur. Ripple işlemlerinin sınırları
   [proje biçimi belgesinde](docs/project-format.md) açıklanır.
4. Başlık/altyazı ve marker ekleyin. Tüm katmanlar ve ses için program
   önizlemesini yeniden oluşturun.
5. Projeyi kaydedin. Export'ta hedef, desteklenen codec/format, çözünürlük, FPS,
   kalite, ses ve altyazı yakma seçeneğini ayarlayın. Kaynak medyanın üzerine
   export yapılması engellenir.

## Kısayollar

| Kısayol | İşlem |
| --- | --- |
| Space | Oynat/durdur |
| V / C | Seçim / bölme aracı |
| Delete | Seçili klipleri sil, boşluğu koru |
| Ctrl/Cmd+Z | Geri al |
| Ctrl/Cmd+Shift+Z | Yinele |
| Ctrl/Cmd+S / O / I | Kaydet / aç / içe aktar |
| Ctrl/Cmd+C / V | Timeline odaktayken kopyala/yapıştır |
| Sol / sağ ok | Bir sequence karesi ilerle/geri git |

Metin alanında yazarken düzenleme kısayolları çalışmaz. Kırpma tutamacında Shift,
ripple trim uygular. Kanal kilitleri ve kaynak sınırları ortak komut katmanında
denetlenir.

## İsteğe bağlı AI kurulumu

Ayarlar'dan Banana AI'yi etkinleştirin; sağlayıcı/model seçin, kendi API anahtarınızı
ekleyin ve bağlantıyı test edin. Anahtarlar main process'te kullanılır; işletim
sistemi şifreli depolaması yoksa yalnızca oturum belleğinde tutulur. Anahtarlar
projeye veya renderer localStorage'a yazılmaz.

Gönderimden önce sağlayıcı, model, seçili klipler ve medya türlerini inceleyin.
Yalnızca metadata gönderilen istekler videodaki konuşma veya sahneleri doğrulayamaz.
Önerilen düzenlemeleri Uygula ile onaylayın; tek undo bütün planı geri alır.
Transkripsiyon zamanlama yetenekleri modele göre değişir. Ayrıntılar:
[AI sağlayıcıları](docs/ai-providers.md), [gizlilik](docs/privacy.md).
Harici API hizmetlerinin ücretleri, koşulları ve veri politikaları ayrıdır.

## Geliştirici kurulumu

Windows x64, Node.js 24+ ve **pnpm 11.25.0** kullanın. Proje kökünde:

```powershell
pnpm install --frozen-lockfile
pnpm setup:ffmpeg
pnpm dev
```

FFmpeg hazırlık betiği sabitlenmiş paketin checksum'ını doğrular. DLL'ler, font
ve lisanslarla birlikte tüm çalışma zamanı dizinini koruyun. Genel dağıtım için
[üçüncü taraf bildirimlerindeki](THIRD_PARTY_NOTICES.md) eksik kaynak/lisans
envanterinin tamamlanması gerekir.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm package:dir
pnpm package:win
```

Yerel paket üretmek kurulum testlerinin geçtiği anlamına gelmez.
[Test](docs/testing.md) ve [yayın](docs/release.md) kapılarını uygulayın.

## Lisans ve katkı

Özgün kaynak kod [MIT](LICENSE) lisanslıdır; hak sahibi 2026 Banana Editor
contributors'dır. FFmpeg LGPLv3, Noto Sans OFL, Lucide ISC ve diğer bileşenler
kendi lisanslarını korur. [Katkı](CONTRIBUTING.md), [güvenlik](SECURITY.md),
[davranış kuralları](CODE_OF_CONDUCT.md) ve
[üçüncü taraf bildirimlerini](THIRD_PARTY_NOTICES.md) inceleyin.

Adobe'nin kamuya açık belgelerinden profesyonel düzenleme iş akışları incelenmiştir.
Banana Editor bağımsızdır; Adobe ile bağlantı veya onay ilişkisi yoktur.
Premiere proje dosyası uyumluluğu vaat edilmez.
