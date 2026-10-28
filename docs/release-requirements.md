# BANANA EDITOR — KARARLI v1.0.0 RELEASE MASTER PROMPT

## 1. Görev ve kesin teslimat hedefi

Sen kıdemli bir masaüstü uygulama geliştiricisi, video işleme mühendisi, ürün tasarımcısı, test mühendisi ve release mühendisi olarak çalışıyorsun.

Benim için Banana Editor isimli, Adobe Premiere Pro’dan esinlenen, özgün tasarımlı, tamamen açık kaynak kodlu ve yapay zekâ destekli bir masaüstü video düzenleme uygulaması geliştir.

Bu görev uygulamayı geliştirmeyi, test etmeyi, paketlemeyi ve GitHub üzerinde kararlı sürüm olarak yayımlamayı kapsar.

HEDEF: BANANA EDITOR v1.0.0 — STABLE RELEASE.

Teslimatı alpha, beta, preview, demo, prototype, MVP veya release candidate olarak adlandırma. Kullanıcıya teslim edilecek sürüm, aşağıda tanımlanan kapsamı tamamlanmış, test edilmiş ve kurulabilir bir kararlı sürüm olmalı.

Sadece package.json içindeki sürümü 1.0.0 yapıp uygulamayı kararlı ilan etme. Kararlılık, çalışan özellikler, test sonuçları, veri bütünlüğü, gerçek export ve kurulum paketiyle doğrulanmalı.

Planı yazdıktan sonra dosyaları gerçekten oluştur ve uygulamayı geliştir. “Bunu yapabiliriz”, “istersen devam edebilirim” veya yalnızca öneri listesi vererek durma. Aşağıdaki zorunlu kapsamı bitirmeden görevi tamamlanmış sayma.

Tanımlanan v1.0.0 kapsamını başka sürümlere erteleyerek küçültme. Geliştirmeyi kendi içinde aşamalara bölmen serbesttir; bu aşamalar kullanıcıya ayrı alpha/beta teslimatları olarak sunulmayacak.

## 2. İlham kaynağı: Adobe Premiere Pro

Referans program: Adobe Premiere Pro / Adobe Premiere.

Resmî ürün sayfası:
https://www.adobe.com/products/premiere.html

Resmî yardım sayfası:
https://helpx.adobe.com/premiere-pro.html

Bu kaynakları profesyonel video düzenleme iş akışını anlamak için incele. Özellikle medya yönetimi, source monitor, program monitor, çok kanallı timeline, Inspector, efektler, altyazı ve export iş akışlarını referans al.

Banana Editor’ın kodu, logosu, ikonları ve görsel kimliği özgün olacak. Adobe’ye ait kod, logo, ekran görüntüsü, kapalı kaynak eklenti veya tescilli varlıkları kopyalama. Adobe ile resmî bağlantı veya onay bulunduğunu ima etme.

Premiere’in bütün özelliklerini birebir karşılamak bu sürümün başarı ölçütü değildir. Başarı ölçütü, bu prompttaki ürün kapsamının eksiksiz ve güvenilir çalışmasıdır. .prproj uyumluluğu gibi uygulanmamış özellikler vaat etme.

## 3. Ürün kimliği ve dağıtım hedefi

Uygulama adı: Banana Editor.
Repository adı: banana-editor.
İlk kararlı sürüm: 1.0.0.
Git etiketi: v1.0.0.
Release başlığı: Banana Editor v1.0.0.
Slogan: Open-source editing. Creative freedom.
Kaynak kod lisansı: MIT.
Ana platform: Windows 10/11 x64; seçilen Electron sürümünün gerçek işletim sistemi desteğini doğrula.
Arayüz dilleri: Türkçe ve İngilizce.
README.md: İngilizce.
README.tr.md: Türkçe.

Windows için gerçek kurulum dosyası ve mümkünse taşınabilir paket üret. Son kullanıcı uygulamayı kullanmak için Node.js, pnpm, Python veya geliştirme ortamı kurmak zorunda kalmamalı.

FFmpeg, font ve diğer gerekli çalışma zamanı bileşenlerini uygun lisans, mimari ve bildirimlerle dağıtıma dahil et. Kullanıcının ayrıca FFmpeg indirip PATH ayarlamasını kararlı Windows sürümünün zorunlu ilk kurulum adımı yapma.

macOS ve Linux uyumluluğunu mimaride gözet. Bu platformlar için paket yayımlarsan ilgili build ve smoke testlerini gerçekten çalıştır. Üretilmemiş veya doğrulanmamış paketler için indirme butonu ekleme.

Kararlı sürüm aşağıdaki ilkeleri taşımalı:
- Temel video düzenleme çevrimdışı çalışır.
- Kullanıcı hesabı zorunlu değildir.
- Filigran veya uygulama içi özellik kilidi yoktur.
- Kaynak medya dosyaları korunur.
- Zorunlu abonelik ve gizli telemetri yoktur.
- AI kullanımı isteğe bağlıdır.
- API anahtarı eklenmeden uygulama açılır, düzenler ve export eder.
- Harici API hizmetleri kendi koşullarına ve ücretlendirmesine tabidir.

## 4. Teknoloji ve mimari

Yeni proje için şu temeli kullan:
- Electron.
- React.
- TypeScript strict mode.
- Vite tabanlı build.
- Zustand veya eşdeğer sade durum yönetimi.
- Tailwind CSS ve erişilebilir UI bileşenleri.
- Açık lisanslı, tutarlı ikon seti.
- Yerel FFmpeg ve ffprobe.
- Gerektiğinde Canvas/WebGL tabanlı timeline ve kompozisyon.
- Zod veya eşdeğer runtime şema doğrulama.
- Vitest.
- Playwright Electron testleri.
- Electron için sürdürülen bir paketleme aracı.
- pnpm, sabitlenmiş paket yöneticisi sürümü ve commit edilmiş lockfile.

Uyumlu, desteklenen sürümleri doğrula. SDK metotları, model adları, paket API’leri veya sürümlerini uydurma.

Mevcut repository varsa önce AGENTS.md, git durumu ve mevcut yapıyı incele. Kullanıcının değişikliklerini koru. Var olan talimat dosyalarını silme.

Mimariyi şu sorumluluklarla ayır:
- Main process: işletim sistemi, güvenli dosya erişimi, credential depolama, API bağlantıları ve iş yönetimi.
- Preload: dar kapsamlı, tipli IPC.
- Renderer: kullanıcı arayüzü.
- Editor core: proje modeli, zaman modeli, komutlar ve undo/redo.
- Media services: probe, proxy, thumbnail, waveform ve cache.
- Playback/render engine: ortak timeline değerlendirme ve çıktı planı.
- AI providers: OpenAI ve Gemini adaptörleri.
- Shared schemas: proje, IPC, job ve edit plan şemaları.

Editor core’u UI framework’ünden bağımsız tut. UI, kısayol ve AI aynı command katmanını kullansın.

Yerel masaüstü render motoru olarak ffmpeg.wasm’a dayanma. Gereksiz backend, mikroservis, bulut veritabanı veya ödeme sistemi kurma.

## 5. Özgün ve tamamlanmış arayüz

Profesyonel bir Banana tasarım dili oluştur:
- Koyu antrasit zemin.
- Muz sarısı vurgu.
- Okunaklı tipografi.
- Tutarlı panel ölçüleri ve ikonlar.
- Seçim, hover, focus ve disabled durumları.
- Video, ses, başlık ve altyazı klipleri için ayırt edilebilir renkler.
- Özgün SVG logo ve gerçek uygulama ikonları.

Ana çalışma alanı:
- Üst menü: File, Edit, View, Sequence, Tools, Help.
- Proje adı, kayıt durumu ve sürüm bilgisi.
- Medya paneli, klasörler ve arama.
- Source monitor.
- Program monitor.
- Inspector / Effect Controls.
- Banana AI paneli.
- Çok kanallı timeline.
- Ses seviye göstergeleri.
- Export paneli ve iş durumu.

Paneller yeniden boyutlandırılabilsin. Düzen kaydedilebilsin ve varsayılana döndürülebilsin. 1366×768 ve 1920×1080 ekranlarda temel işlemler erişilebilir olsun.

Türkçe ve İngilizce çevirileri gerçek metin dosyalarıyla yönet. Uzun çeviriler paneli bozmamalı. Klavye erişimi, focus görünürlüğü ve ekran okuyucu etiketlerini ekle.

Boş proje, işleniyor, eksik medya, disk hatası, API hatası, export hatası ve kurtarma durumlarını tasarla.

Kararlı arayüzde işlevsiz aktif buton, lorem ipsum, “coming soon” paneli, bağlantısız menü veya sahte progress göstergesi bırakma. Kapsam dışı özellikleri ana iş akışına süs olarak koyma.

## 6. Proje ve medya yönetimi

Şunları tamamla:
- Yeni proje.
- Aç, kaydet ve farklı kaydet.
- Son projeler.
- Otomatik kayıt.
- Çökme sonrası kurtarma.
- Sequence çözünürlüğü, kare hızı ve ses ayarları.
- Projeye göre bağıl medya yolları.
- Eksik medyayı bulma ve yeniden bağlama.
- Dosya diyalogu ve sürükleyip bırakarak medya ekleme.
- Video, ses ve görsel dosyaları.
- Medya klasörleri, arama ve metadata.
- Thumbnail, waveform ve kaynak önizlemesi.
- Uyumsuz önizleme codec’i için proxy üretimi.
- Cache boyutu, temizleme ve yeniden üretme.

MP4, MOV ve WebM video; WAV ve MP3 ses; PNG ve JPEG görselleri hedefle. Desteği uzantı üzerinden varsayma; gerçek container/codec yeteneklerini ffprobe ve çalışma zamanı kontrolleriyle belirle.

Kaynak dosyayı değiştirme veya silme. Projeden medya kaldırılması kaynak medyayı silmemeli. İçe aktarma sequence ayarlarını kullanıcıdan habersiz değiştirmemeli.

Büyük videoları renderer belleğine tamamen yükleme. Arka plan işleri için sınırlı eş zamanlılık, iptal ve geçici dosya temizliği uygula.

## 7. Timeline ve düzenleme araçları

En az iki video ve iki ses kanalıyla test edilmiş, yeni kanal eklenebilen bir timeline geliştir.

Zorunlu işlemler:
- Video, ses, görsel, başlık ve altyazı klipleri.
- Sürükleyip bırakma.
- Tekli ve çoklu seçim.
- Taşıma.
- Başlangıç ve bitişten kırpma.
- Playhead’de bölme.
- Normal delete.
- Ripple delete.
- Ripple trim.
- Kopyalama, yapıştırma ve çoğaltma.
- Linked audio/video ve unlink.
- Klipten sesi ayırma.
- Snapping.
- Timeline zoom ve yatay kaydırma.
- Playhead sürükleme ve kare adımlama.
- Marker ekleme ve düzenleme.
- Track ekleme, isimlendirme, kilitleme ve silme.
- Track visibility, mute ve solo.
- Undo/redo.
- Sequence süresinin doğru hesaplanması.

Normal delete boşluğu korusun. Ripple işlemlerinin etkileyeceği track ve linked klip kurallarını açıkça tanımla. Kilitli track’leri değiştirme.

Tek sürükleme veya AI planı tek undo transaction’ı olarak işlenebilsin. Geçersiz işlemler projeyi kısmen değiştirmesin.

Kısayollar:
- Space: oynat/durdur.
- V: seçim.
- C: bölme aracı.
- Delete: sil.
- Ctrl/Cmd+Z: undo.
- Ctrl/Cmd+Shift+Z: redo.
- Ctrl/Cmd+S: kaydet.
- Ctrl/Cmd+O: aç.
- Ctrl/Cmd+I: medya ekle.
- Ctrl/Cmd+C/V: timeline odağındayken kopyala/yapıştır.
- Sol/sağ ok: kare adımlama.

Metin alanlarında yazarken editör kısayolları tetiklenmesin.

## 8. Efektler, geçişler ve ses

Kararlı v1.0.0 kapsamında şu özellikleri gerçekten uygula:

Video:
- Position.
- Scale.
- Rotation.
- Crop.
- Opacity.
- Brightness.
- Contrast.
- Saturation.
- Fit ve fill.
- Temel keyframe sistemi: position, scale ve opacity.

Geçiş:
- Fade in.
- Fade out.
- Cross dissolve.
- Ses fade in/out.

Ses:
- Klip volume.
- Track mute ve solo.
- Waveform.
- Seviye göstergesi.
- Basit peak uyarısı.
- Volume keyframe.

Inspector’da değer değiştirmek önizlemeyi ve export’u etkilemeli. Geçiş için yeterli kaynak handle yoksa geçerli süreyi sınırla veya anlaşılır hata ver. Kaynakta bulunmayan kareleri kontrolsüzce uydurma.

Keyframe interpolasyonunu ve sınır davranışını tanımla. Aynı parametreyi UI, proje dosyası, önizleme ve export farklı yorumlamamalı.

HDR, multicam, nesne takibi ve ileri profesyonel renk yönetimi bu sürümün zorunlu kapsamı değildir; destekleniyormuş gibi gösterme.

## 9. Proje formatı ve zaman doğruluğu

Proje uzantısı .banana olsun. Şema doğrulamalı, sürümlendirilebilir ve okunabilir bir format kullan.

En az şu modelleri kur:
Project, Sequence, Track, Clip, MediaAsset, Effect, Keyframe, Transition, Caption, Marker ve LinkedClipGroup.

Proje kaydında schemaVersion, uygulama sürümü, revision, kimlikler ve medya referansları bulunsun.

Zaman modeli:
- Sequence kare hızı rasyonel sayı olsun.
- Timeline pozisyonları tamsayı karelerle temsil edilsin.
- Kaynak zaman tabanı, timeline kareleri ve ses örnekleri ayrı kavramlar olsun.
- Kaynak in/out ve timeline zamanları arasında açık dönüşüm kur.
- Aralıkları başlangıç dahil, bitiş hariç olarak değerlendir.
- Biriken kayan nokta hatalarını önle.
- 30000/1001 gibi kare hızlarını doğru işle.

Negatif süreyi, var olmayan asset referansını ve kaynak sınırını aşan kırpmayı reddet. Aynı track içindeki çakışma politikasını tanımla; geçişleri açık veri modeliyle temsil et.

Projeyi atomik kaydet. Autosave sağlam manuel kaydı bozmasın. Migration sistemi ve desteklenmeyen yeni şema için güvenli davranış ekle.

API anahtarları proje dosyasına yazılmasın.

## 10. Gerçek önizleme ve senkronizasyon

Program monitor, timeline’ın bütün aktif katmanlarını ve seslerini temsil etsin.

Şunları tamamla:
- Play/pause.
- Seek.
- Kare adımlama.
- Çoklu video katmanı kompozisyonu.
- Görsel ve başlık katmanları.
- Altyazılar.
- Geçişler.
- Video ve ses senkronizasyonu.
- Önizleme kalite seçimi.
- Uyumlu proxy desteği.

Önizlemede yalnızca seçili kaynak videoyu oynatıp bunu timeline önizlemesi olarak sunma.

Timeline değerlendirmesi ve render planı ortak bir modelden gelsin. Layer sırası, kesim noktaları, boşluklar, keyframe, efekt ve ses değerleri export ile aynı anlama gelsin.

Oynatma için merkezi saat ve seek sonrası yeniden senkronizasyon stratejisi kur. Her karede bütün React ağacını yeniden render etme. Uzun timeline için görünür alan odaklı çizim kullan.

Türkçe karakterler, font ölçüleri ve satır kırılması önizleme/export arasında tutarlı olsun. Gerekirse ortak metin layout ve raster varlık üretimi kullan.

## 11. Başlıklar ve altyazılar

Başlık sistemi:
- Başlık ekleme, düzenleme ve silme.
- Font, boyut, renk, arka plan ve hizalama.
- Konum ve süre.
- Birden fazla metin katmanı.
- Türkçe karakter desteği.
- Lisansı uygun, dağıtıma dahil edilmiş varsayılan font.

Altyazı sistemi:
- Manuel altyazı.
- SRT ve WebVTT içe/dışa aktarma.
- Liste üzerinden metin düzeltme.
- Timeline üzerinden zamanlama.
- Stil ve güvenli alan.
- Videoya altyazı yakma.
- İsteğe bağlı AI transkripsiyonu.
- AI ile düzeltme ve çeviri.
- Yapılan değişikliği undo ile geri alma.

Uzun sesleri parçalarken zaman ofsetlerini geri ekle. Transcript kaynak zamanlarını timeline kliplerine doğru eşle.

Model kelime zaman damgası sağlamıyorsa kelime kelime senkron vurgulama desteklendiğini söyleme. Çeviri işleminde segment zamanlarını koru.

## 12. Gerçek video dışa aktarma

Tam çalışan FFmpeg export hattı kur.

Kullanıcı şunları seçebilsin:
- Çıktı dosyası ve klasörü.
- Format ve codec.
- Çözünürlük.
- Kare hızı.
- Kalite/bitrate.
- Ses ayarları.
- Altyazı yakma seçeneği.
- En-boy oranı için fit/fill.

Hazır preset’ler:
- 1920×1080, 16:9.
- 1080×1920, 9:16.
- 1080×1080, 1:1.

Dağıtılan FFmpeg’in encoder yeteneklerine göre MP4 H.264/AAC ve WebM VP9/Opus desteğini doğrula. Lisans ve çalışma zamanı koşulları sağlanmış gerçek seçenekler sun. En az bir yaygın video formatı kararlı release’in kurulu hâlinde çalışmalı.

Export şu içeriği doğru üretmeli:
- Çoklu video katmanı.
- Boşluklar.
- Transform ve renk ayarları.
- Keyframe.
- Geçiş.
- Başlık.
- Altyazı.
- Ses miksajı, volume, mute/solo ve fade.

İlerlemeyi FFmpeg’in gerçek durumundan hesapla. İptal desteği ekle. Disk dolu, izin hatası ve encoder hatasında anlaşılır sonuç göster.

Geçici çıktıyı başarıyla doğruladıktan sonra nihai dosyayı oluştur. Başarısız işi tamamlandı sayma. Üzerine yazma seçimini kullanıcıya bırak.

GPU desteğini tespit et; çalışan CPU render yolu her zaman bulunsun.

## 13. Banana AI: OpenAI ve Gemini

Banana AI paneline iki gerçek sağlayıcı ekle:
- OpenAI API.
- Google Gemini API.

Kullanıcı sağlayıcı, model ve API anahtarını ayarlardan seçebilsin. OpenAI tarafını açıklamada ChatGPT destekli asistan olarak tanıtabilirsin; entegrasyon resmî API üzerinden çalışmalı.

Güncel resmî kaynaklar:
https://developers.openai.com/api/docs/
https://developers.openai.com/api/docs/guides/structured-outputs
https://developers.openai.com/api/docs/guides/transcription
https://ai.google.dev/gemini-api/docs
https://ai.google.dev/gemini-api/docs/video-understanding
https://ai.google.dev/gemini-api/docs/structured-output

Ortak AIProvider sözleşmesi:
- capabilities.
- configuration validation.
- chat.
- analyzeMedia.
- proposeEditPlan.
- Destekleniyorsa transcribe.
- cancellation.
- normalized errors.
- usage bilgisi.

OpenAI için güncel SDK ve uygun Responses API yaklaşımını doğrula. Desteklenen modellerde yapılandırılmış çıktı kullan. Ses transkripsiyonunu uygun ayrı API/model yeteneğiyle uygula.

Gemini için güncel resmî SDK’yı ve desteklenen video/kare/ses analizini kullan. Gerekirse Files API yükleme ve işleme durumunu yönet.

Yetenekleri sağlayıcı ve model bazında kontrol et. Her modelin video, ses ve kelime zamanlamasını desteklediğini varsayma. Desteklenmeyen özellik için doğru açıklama göster.

Model adlarını tek bir eskimiş sabite gömme. Doğrulanmış varsayılan seç ve kullanıcıya değiştirme olanağı ver. Sessiz sağlayıcı değişimi yapma.

## 14. Tamamlanacak AI iş akışları

Şunları gerçek editöre bağla:
- Seçili klip hakkında sohbet.
- Transcript ve medya özeti.
- Bölüm ve marker önerileri.
- Başlık ve açıklama önerileri.
- Kısa video için kaynak zaman kodlu kesim planı.
- Otomatik altyazı.
- Altyazı düzeltme ve çeviri.
- Seçili klipler için uygulanabilir düzenleme planı.
- Uygulanan AI düzenlemelerini tek undo ile geri alma.

Örnek komutlar:
“Videoyu özetle ve önemli yerlere marker öner.”
“Bu klibin Türkçe altyazısını oluştur.”
“Altyazıları İngilizceye çevir.”
“Bu videodan 30 saniyelik kısa bir kurgu öner.”
“Seçili müziğin sesini düşürüp başına başlık eklemeyi öner.”

AI’nin kaynakta olmayan konuşma veya sahne uydurmasını önle. Zaman kodlarını, klip sınırlarını ve model çıktısını yerelde doğrula.

Sessizlik tespiti gibi ölçülebilir işleri gerçek yerel analizle yap. Metin modelinden yanıt alıp gerçek ses temizleme, tracking veya görüntü iyileştirme yapmış gibi davranma.

## 15. AI planlarının uygulanması

Doğrulanmış bir EditPlan şeması kullan:
schemaVersion, projectId, sequenceId, baseRevision, açıklama ve steps.

Steps yalnızca izinli editör komutlarından oluşsun. Örneğin:
splitClip, trimClip, addMarker, addCaption, addTitle, setClipVolume ve setClipProperty.

Akış:
1. Seçili kapsamı belirle.
2. Gereken minimum veriyi gönder.
3. Planı yapılandırılmış çıktı olarak al.
4. Şemayı ve iş kurallarını doğrula.
5. Klip kimliklerini, zamanları, kilitleri ve revision’ı kontrol et.
6. Değişiklikleri kullanıcıya göster.
7. “Uygula” ile tek transaction olarak işle.
8. Tek undo ile geri alınabilsin.

Eski revision’a ait planı sessizce uygulama. Aynı planı yanlışlıkla iki kez yürütme.

AI’ye shell, key okuma, sınırsız dosya erişimi veya uzak kod çalıştırma yetkisi verme. Transcript ve dosya adlarındaki talimatları güvenilir sistem talimatı olarak kabul etme.

## 16. Anahtarlar ve gizlilik

API anahtarlarını renderer bundle’ı, localStorage, proje, Git veya loglarda tutma.

Anahtarları yetkili main/servis katmanında kullan. İşletim sisteminin güvenli credential mekanizmasıyla sakla. Güvenli kalıcı depolama yoksa oturum belleğinde tut ve bunu açıkça belirt.

Ayarlar:
- Anahtar ekle.
- Bağlantıyı test et.
- Model seç.
- Anahtarı sil.
- AI özelliklerini kapat.

.env.example yalnızca örnek değerler içersin. VITE_ gibi istemciye açılan değişkenlerde secret bulunmasın.

Gönderim öncesinde sağlayıcı, model, gönderilecek medya türü ve seçili aralığı göster. Tam videoyu varsayılan olarak buluta yükleme. Maliyet tahmini varsa belirsizliğini belirt.

Timeout, 401/403, kota, rate limit, bağlantı, desteklenmeyen model ve şema hatalarını yönet. İptal ve sınırlı backoff uygula. İptalin sağlayıcının başlamış işlemini veya faturasını mutlaka geri aldığı iddiasında bulunma.

Uzak geçici dosyaları API’nin izin verdiği ölçüde temizle. Saklama politikaları hakkında doğrulanmamış vaat verme.

Gerçek API adaptörlerini uygula. Test fixture’larını canlı API yanıtı gibi gösterme. Canlı test için kullanıcı tarafından sağlanmış anahtar varsa kısa test yap; yoksa implementasyonu ve ağsız testleri tamamla, canlı doğrulama sınırını belirt.

## 17. Güvenlik ve veri bütünlüğü

Electron güvenlik ayarlarını güncel resmî belgelere göre uygula:
https://www.electronjs.org/docs/latest/tutorial/security

En az:
- nodeIntegration kapalı.
- contextIsolation açık.
- Uygun renderer sandbox.
- CSP.
- IPC sender ve payload doğrulama.
- Sınırlı preload API’si.
- Navigasyon ve yeni pencere kısıtları.
- Güvenli external URL kontrolü.

Renderer’a genel shell veya dosya sistemi köprüsü verme. Medya erişimini doğrulanmış asset’lerle sınırla.

FFmpeg’i shell:false ve ayrı argümanlarla çalıştır. Filter graph ve metin/altyazı escaping’ini ayrıca uygula.

Boşluk, Türkçe karakter, tırnak ve özel sembol içeren dosya yollarını test et. Güvenilmeyen proje açıldığında komut veya URL çalışmasın.

Disk dolu, bozuk medya, izin hatası, iptal ve ani kapanmada sağlam proje kaydını koru. Kaynak medyayı export hedefi olarak yanlışlıkla ezmeyi engelle.

## 18. Lisans ve dağıtılan bağımlılıklar

Özgün uygulama kaynak kodu MIT lisanslı olsun.

LICENSE dosyasında kanonik MIT metni, güncel yıl ve doğru hak sahibi ifadesi bulunsun. Kişi adı bilinmiyorsa Banana Editor contributors kullanabilirsin.

package.json lisans alanını ve README lisans bölümünü tutarlı yap.

THIRD_PARTY_NOTICES.md oluştur:
- FFmpeg sürümü ve dağıtım kaynağı.
- FFmpeg build yapılandırması ve lisansı.
- Dahil edilen codec kütüphaneleri.
- Electron ve diğer dağıtılan bileşenler.
- Font ve ikonlar.
- Demo/test varlıkları.

FFmpeg resmî kaynakları:
https://ffmpeg.org/documentation.html
https://ffmpeg.org/legal.html

Build’i sabitle ve indirilen ikiliyi checksum ile doğrula. LGPL/GPL koşullarını gerçek build’e göre incele; gerekli lisans metinlerini, bildirimleri ve kaynak sağlama yükümlülüklerini yerine getir. Sırf ayrı process kullanıldığı için bütün lisans koşullarının ortadan kalktığını varsayma.

--enable-nonfree içeren dağıtılamaz FFmpeg build’ini pakete koyma. Üçüncü tarafları MIT olarak yeniden etiketleme.

OpenAI ve Gemini hizmetleri uygulamanın açık kaynak lisansından ayrı koşullara tabidir. README’de bunu kısa ve açık anlat.

## 19. GitHub proje dosyaları

Eksiksiz hazırla:
- README.md.
- README.tr.md.
- LICENSE.
- CONTRIBUTING.md.
- CODE_OF_CONDUCT.md.
- SECURITY.md.
- CHANGELOG.md.
- THIRD_PARTY_NOTICES.md.
- .gitignore.
- .editorconfig.
- .env.example.
- Projeye uygun AGENTS.md.
- Bug ve feature issue şablonları.
- Pull request şablonu.
- CI workflow.
- Release workflow.
- docs/architecture.md.
- docs/project-format.md.
- docs/ai-providers.md.
- docs/privacy.md.
- docs/testing.md.
- docs/release.md.
- docs/known-limitations.md.
- docs/decisions altındaki mimari kararlar.

README’de doğrudan kullanıcı kurulumu ve geliştirici kurulumu ayrı anlatılsın.

README ayrıca:
- Gerçek özellikler.
- Gerçek uygulama ekran görüntüleri.
- İndirilebilir kararlı sürüm bağlantıları.
- Sistem gereksinimleri.
- İlk video düzenleme ve export akışı.
- Klavye kısayolları.
- AI anahtarı ayarları.
- Çevrimdışı kullanım.
- Gizlilik.
- Test ve build komutları.
- Lisans ve katkı bilgisi içersin.

Uydurma badge, GitHub hesabı, güvenlik e-postası, indirme sayısı veya screenshot ekleme. Yayın sırasında gerçek repository ve Release URL’lerini belgelere işle.

ROADMAP.md ekleyebilirsin; bu prompttaki zorunlu işleri sonraki sürüme taşıma.

## 20. Test ve kalite kapıları

Kararlı release için anlamlı testler kur ve çalıştır.

Editor core:
- Split, trim, move, ripple.
- Linked klipler.
- Lock/mute/solo.
- Undo/redo.
- Keyframe ve geçiş sınırları.
- Zaman dönüşümleri.
- Proje doğrulama, kayıt ve migration.

Gerçek medya:
- FFmpeg ile deterministik küçük video/ses fixture’ları üret.
- Çoklu katman, boşluk, başlık, altyazı, geçiş ve ses miksajı içeren export oluştur.
- ffprobe ile stream, süre, çözünürlük ve FPS kontrolü yap.
- Bilinen zamanlardan kare çıkararak katmanları ve kesim noktalarını doğrula.
- Ses seviyesi/mute için örnek veya RMS kontrolü yap.
- Desteklenen CFR test medyasında kesim/süre doğruluğunu bir kare toleransında doğrula.
- Rasyonel FPS ve farklı kaynak boyutlarını kapsa.
- İptal, disk/izin hatası ve özel dosya adlarını test et.

AI:
- İki provider’ın sözleşme testleri.
- Geçersiz plan ve yetkisiz işlem.
- Eski revision.
- Hatalı zaman kodu.
- Retry ve iptal.
- Secret sızıntısını engelleyen kontroller.
- Anahtarsız CI.
- Varsa ayrı canlı API smoke testi.

Masaüstü E2E:
1. Uygulamayı aç.
2. Proje oluştur.
3. İki video, bir görsel ve iki ses ekle.
4. Birden fazla kanalda düzenle.
5. Böl, kırp, ripple ve undo/redo yap.
6. Efekt, keyframe ve geçiş ekle.
7. Başlık ve altyazı ekle.
8. Kaydet, kapat ve yeniden aç.
9. Export et.
10. Çıktıyı doğrula.

Test başarısını taklit etme. Sadece renderer build’ini çalıştırıp Electron’un ve installer’ın test edildiğini söyleme.

Lint, typecheck, testler, production build ve hedef platform smoke kontrolleri geçmeden release’i yayımlama. Kritik kullanıcı akışında bilinen crash, veri kaybı veya bozuk export varsa önce düzelt.

## 21. Windows kurulum paketleri

Release için en az bir gerçek Windows x64 installer üret; mümkünse portable paket de ekle.

Şunları doğrula:
- Program Node.js olmadan açılıyor.
- Paketlenmiş FFmpeg doğru yoldan çalışıyor.
- İçe aktarma ve export packaged uygulamada çalışıyor.
- Kaynak dosyalar ve varsayılan fontlar bulunuyor.
- userData/cache dizinleri yazılabilir.
- Dosya yolları boşluk ve Türkçe karakterle çalışıyor.
- Sürüm ve uygulama ikonu doğru.
- Installer kuruluyor.
- Kurulan uygulama başlıyor.
- Kaldırma kullanıcıya ait projeleri silmiyor.
- Geliştirme makinesine ait mutlak yollar pakete sızmıyor.

Testleri gerçek Windows runner/ortamında çalıştır. Linux’ta cross-build üretmiş olmayı Windows kurulum testi yerine sayma.

Kod imzalama sertifikası varsa güvenli secret üzerinden kullan. Sertifika yoksa imzalanmamış paketi imzalı gibi sunma; Windows uyarısı oluşabileceğini kurulum belgesinde açıkla. Kararlı sürüm etiketi ile imzalama durumunu birbirine karıştırma.

## 22. CI ve release otomasyonu

GitHub Actions’ta doğrulama ve yayın işlerini ayır.

CI:
- Lockfile’a bağlı temiz kurulum.
- Lint.
- Typecheck.
- Birim/entegrasyon testleri.
- FFmpeg smoke export.
- Production build.
- Desteklenen runner’da Electron E2E.

Release pipeline:
1. Yayınlanacak commit’i sabitle.
2. Bütün zorunlu kontrolleri o commit üzerinde çalıştır.
3. Paketleri üret.
4. Packaged app ve installer smoke testlerini çalıştır.
5. Sürüm, dosya listesi, lisans ve secret kontrollerini yap.
6. SHA-256 checksum dosyası üret.
7. Release notlarını hazırla.
8. Aynı doğrulanmış commit için v1.0.0 etiketi oluştur.
9. GitHub Release’i oluştur ve artifact’ları yükle.
10. Yüklenen dosyaları ve checksum’ları tekrar doğrula.

Publish job yalnızca tüm zorunlu job’lar başarılıysa çalışsın. Başarısız veya iptal edilen test sonrasında yayın gerçekleşmesin.

GitHub token izinlerini ihtiyaca göre sınırla. contents:write yetkisini gerekli yayın işinde kullan. Fork PR’larına secret açma. CI’da zorunlu ücretli API çağrısı yapma.

Yayımlanan dosyalar doğrulanan commit’ten üretilsin. Release oluşturulduktan sonra çalışma ağacında ek değişiklik yapıp bunları aynı testlerin kapsamındaymış gibi gösterme.

## 23. GitHub üzerinde gerçek kararlı Release yayını

Bu prompt, doğru repository ve yetkili oturum mevcut olduğunda aşağıdaki yayın işlemlerini yapman için talimatımdır:
- Gerekli proje commit’lerini oluştur.
- Doğru repository’ye push et.
- v1.0.0 etiketini oluştur ve push et.
- Kurulum paketleriyle birlikte kararlı GitHub Release yayımla.

Önce git remote, repository sahibi ve mevcut GitHub kimliğini doğrula. Hedef repository belirsizse rastgele hesaba yayın yapma. Kullanıcı repository belirtmişse onu kullan. Boş projede tek ve açıkça doğrulanmış kişisel hesap varsa banana-editor repository’sini o hesapta oluşturabilirsin. Kurum hesabını veya başka projeye ait remote’u tahmin etme.

GitHub CLI kullanılabiliyorsa resmî belgeleri kontrol et:
https://cli.github.com/manual/gh_release_create
https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

Release özellikleri:
- Tag: v1.0.0.
- Başlık: Banana Editor v1.0.0.
- prerelease: false.
- Son durum draft: false.
- Uygunsa Latest release.
- Gerçek release notları.
- Windows installer.
- Üretilmişse portable paket.
- SHA256SUMS.txt.
- Gerekli üçüncü taraf lisans/notice dosyaları.
- Doğrulanmışsa diğer platform paketleri.

Geçici draft, yalnızca yüklemeleri tamamlamak için iç işlem olarak kullanılabilir; görev sonunda yayımlanmış kararlı Release bulunmalı.

Release açıklamasında:
- Tamamlanan özellikler.
- Desteklenen platformlar.
- Kurulum.
- AI API ayarları.
- İmzalama durumu.
- Gerçek sınırlamalar.
- Checksum doğrulaması.
- Lisans bilgisi yer alsın.

GitHub’ın otomatik source archive dosyalarını kurulum paketi olarak sunma. Download bağlantısı gerçek installer artifact’ına gitsin.

Var olan yayımlanmış tag’i veya Release asset’larını sessizce silme/değiştirme. Aynı sürüm çakışıyorsa mevcut durumu incele ve uygun yeni SemVer sürümünü belirle; geçmişi force-push ile yeniden yazma.

Yayın sonrası:
- Release API/CLI ile draft ve prerelease durumlarını kontrol et.
- Tag’in doğrulanan commit’e işaret ettiğini kontrol et.
- Asset isimlerini ve boyutlarını doğrula.
- En az zorunlu installer’ı indirip checksum karşılaştır.
- README indirme bağlantılarını kontrol et.
- Gerçek repository ve Release URL’sini teslim et.

Kimlik doğrulama, repository seçimi veya ağ erişimi gibi dış bir engel varsa eksik kısmı açıkça belirt. Önce bütün bağımsız geliştirme, test ve paketleme işlerini tamamla. Sonra yalnızca engeli kaldırmak için gereken bilgiyi/erişimi iste. Yayın yapılamamışken “Release yayımlandı” deme ve bu engeli aşmak için sürümü alpha/beta olarak yeniden adlandırma.

## 24. Release tamamlanma tanımı

Bu görev ancak aşağıdakiler karşılandığında başarıyla tamamlanmış sayılır:
- Tanımlı v1.0.0 özellikleri çalışıyor.
- Temel kullanımda sahte veri veya işlevsiz kontrol bulunmuyor.
- Gerçek medya ile düzenleme ve export doğrulanmış.
- Proje kaydı, yeniden açma ve kurtarma çalışıyor.
- OpenAI ve Gemini adaptörleri gerçek entegrasyon içeriyor.
- Anahtarsız çevrimdışı kullanım çalışıyor.
- Kaynak kod, lisans ve belgeler repository’de.
- Windows kurulum paketi üretilmiş ve hedef ortamda doğrulanmış.
- Lisans/notice ve checksum dosyaları hazır.
- Zorunlu CI kontrolleri geçiyor.
- Doğru commit etiketlenmiş.
- GitHub Release yayımlanmış ve kararlı sürüm olarak işaretlenmiş.
- İndirme bağlantıları doğrulanmış.

“Hazır” kelimesini bu koşullara göre kullan. Kapsam dışı bir özelliğin eksikliği ile zorunlu iş akışındaki hatayı ayır. Bilinen sınırlamaları yazmak, bozuk zorunlu özelliği teslim edilebilir yapmaz.

## 25. Çalışma ve son teslim raporu

Çalışma sırası:
1. Ortamı ve repository’yi incele.
2. Kısa planı yaz.
3. Mimari ve sürüm seçimlerini doğrula.
4. Çalışan editör çekirdeğini geliştir.
5. Bütün zorunlu özellikleri tamamla.
6. AI entegrasyonlarını bağla.
7. Test et, hataları düzelt.
8. Belgeleri ve lisans envanterini tamamla.
9. Production paketlerini üret.
10. Packaged uygulamayı doğrula.
11. Release pipeline’ını çalıştır.
12. Kararlı GitHub Release’i yayımla.
13. İndirme ve checksum doğrulaması yap.
14. Son raporu ver.

Rutin teknik kararlarda makul tercihler yap ve devam et. Sadece plan verip durma. Kendi yapabileceğin işi kullanıcıya elle yaptırma.

Oturum sınırına ulaşırsan sağlam çalışma durumunu koru ve docs/implementation-status.md içine kaldığın yeri yaz. Bu ara kayıt teslimat değildir; bir sonraki oturumda aynı kararlı release hedefine devam et. Bitmemiş işi tamamlanmış gibi sunma.

Son rapor kısa ve somut olsun:
- Yayınlanan sürüm.
- Repository URL’si.
- Kararlı Release URL’si.
- Installer ve diğer gerçek indirme bağlantıları.
- Geçen testler ve doğrulanmış platform.
- Canlı API testlerinin durumu.
- İmzalama durumu.
- Varsa gerçek sınırlamalar veya dış yayın engeli.

Şimdi çalışma alanını incele, kısa uygulama planını yaz ve Banana Editor’ı tanımlanan kapsamıyla geliştirip doğrudan kararlı v1.0.0 Release olarak teslim etmek için çalışmaya başla.
