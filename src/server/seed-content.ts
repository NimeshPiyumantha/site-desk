/** Realistic example content for the demo (Sri Lankan travel campaigns in English, Tamil and Sinhala). */
import type { Localized, SiteContent } from "@/lib/content/types";

type Tri = [string, string?, string?];
const L = (langs: string[], [en, ta, si]: Tri): Localized => {
  const out: Localized = { en };
  if (langs.includes("ta")) out.ta = ta ?? "";
  if (langs.includes("si")) out.si = si ?? "";
  return out;
};

const CITY: Record<string, Tri> = {
  Colombo: ["Colombo", "கொழும்பு", "කොළඹ"],
  Galle: ["Galle", "காலி", "ගාල්ල"],
  Kandy: ["Kandy", "கண்டி", "මහනුවර"],
  Jaffna: ["Jaffna", "யாழ்ப்பாணம்", "යාපනය"],
  Trincomalee: ["Trincomalee", "திருகோணமலை", "ත්‍රිකුණාමලය"],
  Ella: ["Ella", "எல்ல", "ඇල්ල"],
};

export function summerEscapeContent(city: keyof typeof CITY, langs: string[], publicLangs: string[], contact: { email: string; phone: string; whatsapp: string; street: string }): SiteContent {
  const [cEn, cTa, cSi] = CITY[city];
  const l = (t: Tri) => L(langs, t);
  return {
    settings: {
      defaultLanguage: "en",
      languages: langs.map((id) => ({ id, public: publicLangs.includes(id) })),
      gaId: "G-SE" + city.slice(0, 4).toUpperCase() + "2026",
      gtmId: "",
    },
    brand: { name: `Summer Escape ${cEn}`, primaryColor: "#0f5c55", accentColor: "#f6efe3", logoUrl: "" },
    seo: {
      title: l([`Summer Escape ${cEn} – Beach & holiday packages in Sri Lanka`, `சம்மர் எஸ்கேப் ${cTa} – இலங்கையில் கடற்கரை மற்றும் விடுமுறை தொகுப்புகள்`, `සමර් එස්කේප් ${cSi} – ශ්‍රී ලංකාවේ වෙරළ සහ නිවාඩු පැකේජ`]),
      description: l([
        `Hand-picked stays, family beach packages and summer offers from our ${cEn} travel team.`,
        `எங்கள் ${cTa} பயணக் குழுவின் தேர்ந்தெடுக்கப்பட்ட தங்குமிடங்கள், குடும்பக் கடற்கரைத் தொகுப்புகள் மற்றும் கோடைச் சலுகைகள்.`,
        `අපගේ ${cSi} සංචාරක කණ්ඩායමෙන් තෝරාගත් නවාතැන්, පවුලේ වෙරළ පැකේජ සහ ගිම්හාන දීමනා.`,
      ]),
    },
    nav: {
      destinations: l(["Destinations", "இடங்கள்", "ගමනාන්ත"]),
      offers: l(["Offers", "சலுகைகள்", "දීමනා"]),
      about: l(["About", "எங்களைப் பற்றி", "අප ගැන"]),
      contact: l(["Contact", "தொடர்பு", "සම්බන්ධ වන්න"]),
      planTrip: l(["Plan your trip", "பயணத்தைத் திட்டமிடுங்கள்", "සංචාරය සැලසුම් කරන්න"]),
    },
    hero: {
      title: l(["Your next escape starts here.", "உங்கள் அடுத்த பயணம் இங்கே தொடங்குகிறது.", "ඔබේ ඊළඟ සංචාරය මෙතැනින් ආරම්භ වේ."]),
      subtitle: l([
        "Discover beautiful places, thoughtful stays and offers worth exploring.",
        "அழகான இடங்கள், சிந்தனையுடன் அமைந்த தங்குமிடங்கள் மற்றும் ஆராயத்தக்க சலுகைகளைக் கண்டறியுங்கள்.",
        "සුන්දර ස්ථාන, සැලකිලිමත් නවාතැන් සහ ගවේෂණය කළ යුතු දීමනා සොයා ගන්න.",
      ]),
      image: "/demo/hero-coast.svg",
      primaryCta: l(["Explore destinations", "இடங்களை ஆராயுங்கள்", "ගමනාන්ත ගවේෂණය කරන්න"]),
      secondaryCta: l(["View summer offers", "கோடைச் சலுகைகளைப் பாருங்கள்", "ගිම්හාන දීමනා බලන්න"]),
    },
    banner: {
      enabled: true,
      text: l(["Summer offer: Save up to 20% on selected stays", "கோடைச் சலுகை: தேர்ந்தெடுக்கப்பட்ட தங்குமிடங்களில் 20% வரை சேமியுங்கள்", "ගිම්හාන දීමනාව: තෝරාගත් නවාතැන් සඳහා 20% දක්වා ඉතිරි කරගන්න"]),
      linkText: l(["View offers", "சலுகைகளைப் பாருங்கள்", "දීමනා බලන්න"]),
    },
    categories: {
      heading: l(["Find your kind of getaway", "உங்களுக்கான விடுமுறையைத் தேர்ந்தெடுங்கள்", "ඔබට ගැළපෙන නිවාඩුව සොයන්න"]),
      items: [
        { id: "coastal", title: l(["Coastal escapes", "கடற்கரை விடுமுறைகள்", "වෙරළබඩ නිවාඩු"]), text: l(["Sun-drenched shores and laid-back beach towns.", "சூரிய ஒளி நிறைந்த கரைகளும் அமைதியான கடற்கரை நகரங்களும்.", "හිරු එළිය පිරි වෙරළ සහ සන්සුන් වෙරළබඩ නගර."]), image: "/demo/coast.svg" },
        { id: "city", title: l(["City weekends", "நகர வார இறுதிகள்", "නගර සති අන්ත"]), text: l(["Culture, great food and memorable moments.", "கலாச்சாரம், சுவையான உணவு, மறக்க முடியாத தருணங்கள்.", "සංස්කෘතිය, රසවත් ආහාර සහ අමතක නොවන මොහොත."]), image: "/demo/city.svg" },
        { id: "nature", title: l(["Nature retreats", "இயற்கை ஓய்வுகள்", "සොබාදහමේ විවේකය"]), text: l(["Wide open spaces and a slower pace.", "பரந்த வெளிகளும் நிதானமான வாழ்க்கையும்.", "විශාල විවෘත අවකාශ සහ සෙමින් ගෙවෙන ජීවිතය."]), image: "/demo/nature.svg" },
      ],
    },
    offers: {
      heading: l(["Summer offers", "கோடைச் சலுகைகள்", "ගිම්හාන දීමනා"]),
      intro: l([
        "Hand-picked packages for families, couples and friends. Prices include breakfast and transfers.",
        "குடும்பங்கள், தம்பதிகள் மற்றும் நண்பர்களுக்காகத் தேர்ந்தெடுக்கப்பட்ட தொகுப்புகள். விலைகளில் காலை உணவும் போக்குவரத்தும் அடங்கும்.",
        "පවුල්, යුවළයන් සහ මිතුරන් සඳහා තෝරාගත් පැකේජ. මිල ගණන්වලට උදේ ආහාරය සහ ප්‍රවාහනය ඇතුළත් වේ.",
      ]),
      bookButton: l(["Ask about this offer", "இந்தச் சலுகை பற்றிக் கேளுங்கள்", "මෙම දීමනාව ගැන විමසන්න"]),
      items: [
        {
          id: "fam-beach",
          code: "FAM-BEACH",
          title: l(["Family Beach Package", "குடும்பக் கடற்கரைத் தொகுப்பு", "පවුලේ වෙරළ පැකේජය"]),
          description: l([
            "3 nights by the sea for two adults and two children, with breakfast, airport transfers and a sunset boat ride.",
            "இரண்டு பெரியவர்கள் மற்றும் இரண்டு குழந்தைகளுக்கு கடலோரத்தில் 3 இரவுகள், காலை உணவு, விமான நிலையப் போக்குவரத்து மற்றும் மாலை படகுச் சவாரியுடன்.",
            "වැඩිහිටියන් දෙදෙනෙකු සහ ළමුන් දෙදෙනෙකු සඳහා මුහුද අසල රාත්‍රී 3ක්, උදේ ආහාරය, ගුවන්තොටුපොළ ප්‍රවාහනය සහ හිරු බැසයන බෝට්ටු සවාරියක් සමඟ.",
          ]),
          price: l(["LKR 45,000 per family", "ஒரு குடும்பத்திற்கு ரூ. 45,000", "පවුලකට රු. 45,000"]),
          image: "/demo/beach.svg",
        },
        {
          id: "couple-retreat",
          code: "COUPLE-RETREAT",
          title: l(["Couples’ Hideaway", "தம்பதிகளுக்கான மறைவிடம்", "යුවළයන් සඳහා සැඟවුණු නිවහන"]),
          description: l(["2 nights in a boutique villa with dinner by the pool.", "குளக்கரையில் இரவு உணவுடன் ஒரு பூட்டிக் வில்லாவில் 2 இரவுகள்.", "තටාකය අසල රාත්‍රී ආහාරය සමඟ බුටීක් විලාවක රාත්‍රී 2ක්."]),
          price: l(["LKR 32,500 per couple", "ஒரு தம்பதிக்கு ரூ. 32,500", "යුවළකට රු. 32,500"]),
          image: "/demo/villa.svg",
        },
      ],
    },
    cta: {
      heading: l(["Let’s plan something memorable.", "மறக்க முடியாத ஒன்றைத் திட்டமிடுவோம்.", "අමතක නොවන දෙයක් සැලසුම් කරමු."]),
      text: l([
        "Our travel experts are here to help you create a summer escape that’s just right for you.",
        "உங்களுக்கு ஏற்ற கோடை விடுமுறையை உருவாக்க எங்கள் பயண நிபுணர்கள் தயாராக உள்ளனர்.",
        "ඔබට ගැළපෙන ගිම්හාන නිවාඩුවක් නිර්මාණය කිරීමට අපගේ සංචාරක විශේෂඥයින් සූදානම්.",
      ]),
      button: l(["Get in touch", "தொடர்பு கொள்ளுங்கள்", "අප අමතන්න"]),
    },
    about: {
      title: l([`About Summer Escape ${cEn}`, `சம்மர் எஸ்கேப் ${cTa} பற்றி`, `සමර් එස්කේප් ${cSi} ගැන`]),
      intro: l(["We are a Sri Lankan travel team that has planned island holidays since 2012.", "நாங்கள் 2012 முதல் தீவு விடுமுறைகளைத் திட்டமிடும் இலங்கை பயணக் குழு.", "අපි 2012 සිට දිවයින් නිවාඩු සැලසුම් කරන ශ්‍රී ලාංකික සංචාරක කණ්ඩායමකි."]),
      body: l([
        "From quiet beach towns to busy city weekends, we put together trips that feel personal. Every stay is visited by our team, every price is clear, and someone is always one call away while you travel.",
        "அமைதியான கடற்கரை நகரங்கள் முதல் பரபரப்பான நகர வார இறுதிகள் வரை, தனிப்பட்ட உணர்வைத் தரும் பயணங்களை நாங்கள் ஏற்பாடு செய்கிறோம். ஒவ்வொரு தங்குமிடத்தையும் எங்கள் குழு நேரில் பார்வையிடுகிறது, ஒவ்வொரு விலையும் தெளிவானது, நீங்கள் பயணிக்கும்போது எப்போதும் ஒருவர் உதவிக்கு இருப்பார்.",
        "සන්සුන් වෙරළබඩ නගරවල සිට කාර්යබහුල නගර සති අන්ත දක්වා, පුද්ගලික හැඟීමක් ලබා දෙන සංචාර අපි සකස් කරමු. සෑම නවාතැනක්ම අපගේ කණ්ඩායම විසින් පරීක්ෂා කරනු ලැබේ, සෑම මිලක්ම පැහැදිලියි, ඔබ සංචාරය කරන අතරතුර උදව් සඳහා සැමවිටම කෙනෙකු සිටී.",
      ]),
      image: "/demo/team.svg",
    },
    contact: {
      heading: l(["Talk to a travel expert", "பயண நிபுணருடன் பேசுங்கள்", "සංචාරක විශේෂඥයෙකු සමඟ කතා කරන්න"]),
      email: contact.email,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      address: l([`${contact.street}, ${cEn}, Sri Lanka`, `${contact.street}, ${cTa}, இலங்கை`, `${contact.street}, ${cSi}, ශ්‍රී ලංකාව`]),
      formIntro: l(["Send us a message and we will reply within one working day.", "எங்களுக்கு ஒரு செய்தி அனுப்புங்கள்; ஒரு வேலை நாளுக்குள் பதிலளிப்போம்.", "අපට පණිවිඩයක් එවන්න; වැඩ කරන දිනයක් ඇතුළත අපි පිළිතුරු දෙන්නෙමු."]),
      formName: l(["Your name", "உங்கள் பெயர்", "ඔබේ නම"]),
      formEmail: l(["Your email", "உங்கள் மின்னஞ்சல்", "ඔබේ විද්‍යුත් තැපෑල"]),
      formMessage: l(["How can we help?", "நாங்கள் எப்படி உதவலாம்?", "අපට උදව් කළ හැක්කේ කෙසේද?"]),
      formSubmit: l(["Send message", "செய்தி அனுப்பு", "පණිවිඩය යවන්න"]),
      formThanks: l(["Thank you! We will be in touch soon.", "நன்றி! விரைவில் தொடர்பு கொள்வோம்.", "ස්තූතියි! අපි ඉක්මනින් ඔබව සම්බන්ධ කර ගන්නෙමු."]),
    },
    footer: {
      tagline: l(["Thoughtful island holidays since 2012.", "2012 முதல் சிந்தனையுடன் அமைந்த தீவு விடுமுறைகள்.", "2012 සිට සැලකිලිමත් දිවයින් නිවාඩු."]),
      instagram: "https://instagram.com/summerescape.lk",
      facebook: "https://facebook.com/summerescape.lk",
      youtube: "https://youtube.com/@summerescapelk",
    },
  };
}

/** English-only website, used to demonstrate copying a site and adding Tamil and Sinhala later. */
export function hillCountryContent(): SiteContent {
  const e = (en: string) => ({ en });
  return {
    settings: { defaultLanguage: "en", languages: [{ id: "en", public: true }], gaId: "G-HILLTEA26", gtmId: "GTM-HT2026A" },
    brand: { name: "Hill Country Tea Tours", primaryColor: "#2f5d3a", accentColor: "#eef3e6", logoUrl: "" },
    seo: { title: e("Hill Country Tea Tours – Tea estate stays and scenic train trips"), description: e("Small-group tours through Sri Lanka’s tea country: bungalow stays, waterfall hikes and the scenic train to Ella.") },
    nav: { destinations: e("Tours"), offers: e("Offers"), about: e("About"), contact: e("Contact"), planTrip: e("Plan my trip") },
    hero: { title: e("Wake up above the clouds."), subtitle: e("Tea estate bungalows, misty mountain trails and the famous scenic train to Ella."), image: "/demo/hero-hills.svg", primaryCta: e("See the tours"), secondaryCta: e("View winter offers") },
    banner: { enabled: true, text: e("Winter offer: a free tea tasting with every 3-night stay"), linkText: e("See offers") },
    categories: {
      heading: e("Choose your hill-country trip"),
      items: [
        { id: "tea-stays", title: e("Tea estate stays"), text: e("Colonial bungalows among the tea bushes."), image: "/demo/tea.svg" },
        { id: "rail", title: e("Scenic rail journeys"), text: e("The blue train through the mountains."), image: "/demo/train.svg" },
        { id: "waterfalls", title: e("Waterfall hikes"), text: e("Easy trails to the island’s finest falls."), image: "/demo/nature.svg" },
      ],
    },
    offers: {
      heading: e("Winter offers"),
      intro: e("Small-group tours with a local guide. Prices include meals and transport from Kandy."),
      bookButton: e("Ask about this tour"),
      items: [
        { id: "tea-trail", code: "TEA-TRAIL", title: e("Tea Trail Weekend"), description: e("2 nights in a tea planter’s bungalow with a factory visit and guided tasting."), price: e("LKR 38,000 per person"), image: "/demo/tea.svg" },
        { id: "rail-ella", code: "RAIL-ELLA", title: e("Kandy to Ella by Train"), description: e("Reserved observation-car seats, a hotel in Ella and the Nine Arch Bridge walk."), price: e("LKR 27,500 per person"), image: "/demo/train.svg" },
      ],
    },
    cta: { heading: e("Ready for the hills?"), text: e("Tell us your dates and we will build a trip around them."), button: e("Plan my trip") },
    about: {
      title: e("About Hill Country Tea Tours"),
      intro: e("Family-run since 2009 and based in Nuwara Eliya."),
      body: e("Our guides grew up among the tea estates. We keep our groups small, work with local bungalow owners, and plan every trip around the weather, the trains and the best views."),
      image: "/demo/team.svg",
    },
    contact: {
      heading: e("Plan your hill-country trip"),
      email: "hello@hillcountrytea.example",
      phone: "+94 52 222 4410",
      whatsapp: "+94 77 410 2209",
      address: e("14 Lake Road, Nuwara Eliya, Sri Lanka"),
      formIntro: e("Tell us your dates and group size – we reply within one working day."),
      formName: e("Your name"),
      formEmail: e("Your email"),
      formMessage: e("Your dates and questions"),
      formSubmit: e("Send"),
      formThanks: e("Thank you! Our team will reply soon."),
    },
    footer: {
      tagline: e("Small-group tours in Sri Lanka’s tea country."),
      instagram: "https://instagram.com/hillcountryteatours",
      facebook: "https://facebook.com/hillcountryteatours",
      youtube: "",
    },
  };
}

export function surfCampContent(): SiteContent {
  const c = summerEscapeContent("Trincomalee", ["en"], ["en"], { email: "stay@arugamsurf.example", phone: "+94 63 224 8800", whatsapp: "", street: "Main Street" });
  c.brand = { name: "Arugam Bay Surf Camp", primaryColor: "#1d4e89", accentColor: "#e8f1fb", logoUrl: "" };
  c.settings.gaId = "G-SURF2026X";
  c.seo.title = { en: "Arugam Bay Surf Camp – Surf lessons and beach stays" };
  c.seo.description = { en: "Surf lessons for every level, beach cabanas and good food on Sri Lanka’s east coast." };
  c.hero.title = { en: "Catch the best waves on the east coast." };
  c.hero.subtitle = { en: "Surf lessons for every level, beach cabanas and good food." };
  c.hero.image = "/demo/surf.svg";
  c.banner.text = { en: "Season opening: 15% off week-long surf packages" };
  c.offers.heading = { en: "Surf packages" };
  c.offers.items = [
    { id: "surf-week", code: "SURF-WEEK", title: { en: "Surf Week" }, description: { en: "7 nights in a beach cabana with 10 lessons and board hire." }, price: { en: "LKR 96,000 per person" }, image: "/demo/surf.svg" },
  ];
  c.about.title = { en: "About Arugam Bay Surf Camp" };
  c.contact.address = { en: "Main Street, Arugam Bay, Sri Lanka" };
  c.footer.tagline = { en: "Surf, sleep, repeat – since 2015." };
  c.footer.instagram = "https://instagram.com/arugambaysurfcamp";
  c.footer.facebook = "";
  c.footer.youtube = "https://youtube.com/@arugambaysurf";
  return c;
}

/** Tamil translations supplied by the "client" for Hill Country Tea Tours (used for the demo files). */
export const HILL_COUNTRY_TAMIL: Record<string, string> = {
  "seo.title": "ஹில் கண்ட்ரி டீ டூர்ஸ் – தேயிலைத் தோட்டத் தங்குமிடங்களும் அழகிய ரயில் பயணங்களும்",
  "seo.description": "இலங்கையின் தேயிலை நாட்டில் சிறு குழுச் சுற்றுலாக்கள்: பங்களா தங்குமிடங்கள், நீர்வீழ்ச்சி நடைகள் மற்றும் எல்லவுக்கான அழகிய ரயில் பயணம்.",
  "nav.destinations": "சுற்றுலாக்கள்",
  "nav.offers": "சலுகைகள்",
  "nav.about": "எங்களைப் பற்றி",
  "nav.contact": "தொடர்பு",
  "nav.planTrip": "என் பயணத்தைத் திட்டமிடு",
  "hero.title": "மேகங்களுக்கு மேலே கண் விழியுங்கள்.",
  "hero.subtitle": "தேயிலைத் தோட்டப் பங்களாக்கள், பனி மூடிய மலைப் பாதைகள் மற்றும் எல்லவுக்கான புகழ்பெற்ற அழகிய ரயில்.",
  "hero.primaryCta": "சுற்றுலாக்களைப் பாருங்கள்",
  "hero.secondaryCta": "குளிர்காலச் சலுகைகளைப் பாருங்கள்",
  "banner.text": "குளிர்காலச் சலுகை: ஒவ்வொரு 3 இரவுத் தங்குதலுக்கும் இலவச தேநீர் சுவைப்பு",
  "banner.linkText": "சலுகைகளைப் பாருங்கள்",
  "categories.heading": "உங்கள் மலைநாட்டுப் பயணத்தைத் தேர்ந்தெடுங்கள்",
  "categories.items.@tea-stays.title": "தேயிலைத் தோட்டத் தங்குமிடங்கள்",
  "categories.items.@tea-stays.text": "தேயிலைச் செடிகளுக்கு இடையே காலனித்துவப் பங்களாக்கள்.",
  "categories.items.@rail.title": "அழகிய ரயில் பயணங்கள்",
  "categories.items.@rail.text": "மலைகளின் ஊடே செல்லும் நீல ரயில்.",
  "categories.items.@waterfalls.title": "நீர்வீழ்ச்சி நடைகள்",
  "categories.items.@waterfalls.text": "தீவின் மிகச் சிறந்த நீர்வீழ்ச்சிகளுக்கு எளிதான பாதைகள்.",
  "offers.heading": "குளிர்காலச் சலுகைகள்",
  "offers.intro": "உள்ளூர் வழிகாட்டியுடன் சிறு குழுச் சுற்றுலாக்கள். விலைகளில் உணவும் கண்டியிலிருந்து போக்குவரத்தும் அடங்கும்.",
  "offers.bookButton": "இந்தச் சுற்றுலா பற்றிக் கேளுங்கள்",
  "offers.items.@tea-trail.title": "தேயிலைப் பாதை வார இறுதி",
  "offers.items.@tea-trail.description": "தொழிற்சாலைப் பார்வை மற்றும் வழிகாட்டப்பட்ட சுவைப்புடன் தேயிலைத் தோட்டக்காரரின் பங்களாவில் 2 இரவுகள்.",
  "offers.items.@tea-trail.price": "ஒருவருக்கு ரூ. 38,000",
  "offers.items.@rail-ella.title": "கண்டியிலிருந்து எல்லவுக்கு ரயிலில்",
  "offers.items.@rail-ella.description": "முன்பதிவு செய்யப்பட்ட பார்வைப் பெட்டி இருக்கைகள், எல்லவில் ஹோட்டல் மற்றும் ஒன்பது வளைவுப் பாலம் நடை.",
  "offers.items.@rail-ella.price": "ஒருவருக்கு ரூ. 27,500",
  "cta.heading": "மலைகளுக்குத் தயாரா?",
  "cta.text": "உங்கள் தேதிகளைச் சொல்லுங்கள், அவற்றைச் சுற்றி ஒரு பயணத்தை உருவாக்குவோம்.",
  "cta.button": "என் பயணத்தைத் திட்டமிடு",
  "about.title": "ஹில் கண்ட்ரி டீ டூர்ஸ் பற்றி",
  "about.intro": "2009 முதல் குடும்பமாக நடத்தப்படுகிறது, நுவரெலியாவில் அமைந்துள்ளது.",
  "about.body": "எங்கள் வழிகாட்டிகள் தேயிலைத் தோட்டங்களுக்கு இடையே வளர்ந்தவர்கள். குழுக்களைச் சிறியதாக வைத்திருக்கிறோம், உள்ளூர் பங்களா உரிமையாளர்களுடன் இணைந்து பணியாற்றுகிறோம், வானிலை, ரயில்கள் மற்றும் சிறந்த காட்சிகளைக் கொண்டு ஒவ்வொரு பயணத்தையும் திட்டமிடுகிறோம்.",
  "contact.heading": "உங்கள் மலைநாட்டுப் பயணத்தைத் திட்டமிடுங்கள்",
  "contact.address": "14 ஏரி வீதி, நுவரெலியா, இலங்கை",
  "contact.formIntro": "உங்கள் தேதிகளையும் குழு அளவையும் சொல்லுங்கள் – ஒரு வேலை நாளுக்குள் பதிலளிப்போம்.",
  "contact.formName": "உங்கள் பெயர்",
  "contact.formEmail": "உங்கள் மின்னஞ்சல்",
  "contact.formMessage": "உங்கள் தேதிகளும் கேள்விகளும்",
  "contact.formSubmit": "அனுப்பு",
  "contact.formThanks": "நன்றி! எங்கள் குழு விரைவில் பதிலளிக்கும்.",
  "footer.tagline": "இலங்கையின் தேயிலை நாட்டில் சிறு குழுச் சுற்றுலாக்கள்.",
};

/** Sinhala translations – deliberately incomplete, to show how missing texts are reported. */
export const HILL_COUNTRY_SINHALA_PARTIAL: Record<string, string> = {
  "seo.title": "හිල් කන්ට්‍රි ටී ටුවර්ස් – තේ වතු නවාතැන් සහ අලංකාර දුම්රිය ගමන්",
  "seo.description": "ශ්‍රී ලංකාවේ තේ රටේ කුඩා කණ්ඩායම් සංචාර: බංගලා නවාතැන්, දිය ඇලි පා ගමන් සහ ඇල්ලට අලංකාර දුම්රිය ගමන.",
  "nav.destinations": "සංචාර",
  "nav.offers": "දීමනා",
  "nav.about": "අප ගැන",
  "nav.contact": "සම්බන්ධ වන්න",
  "nav.planTrip": "මගේ සංචාරය සැලසුම් කරන්න",
  "hero.title": "වලාකුළුවලට ඉහළින් අවදි වන්න.",
  "hero.subtitle": "තේ වතු බංගලා, මීදුමෙන් වැසුණු කඳු මාවත් සහ ඇල්ලට යන ප්‍රසිද්ධ අලංකාර දුම්රිය.",
  "hero.primaryCta": "සංචාර බලන්න",
  "hero.secondaryCta": "ශීත ඍතු දීමනා බලන්න",
  "banner.text": "ශීත ඍතු දීමනාව: රාත්‍රී 3ක නවාතැනක් සමඟ නොමිලේ තේ රස බැලීමක්",
  "banner.linkText": "දීමනා බලන්න",
  "categories.heading": "ඔබේ කඳුකර සංචාරය තෝරන්න",
  "categories.items.@tea-stays.title": "තේ වතු නවාතැන්",
  "categories.items.@tea-stays.text": "තේ පඳුරු අතර යටත් විජිත බංගලා.",
  "categories.items.@rail.title": "අලංකාර දුම්රිය ගමන්",
  "categories.items.@rail.text": "කඳු හරහා යන නිල් දුම්රිය.",
  "offers.heading": "ශීත ඍතු දීමනා",
  "offers.items.@tea-trail.title": "තේ මාවත් සති අන්තය",
  "offers.items.@tea-trail.price": "එක් අයෙකුට රු. 38,000",
  "offers.items.@rail-ella.title": "මහනුවර සිට ඇල්ලට දුම්රියෙන්",
  "offers.items.@rail-ella.price": "එක් අයෙකුට රු. 27,500",
  "cta.heading": "කඳුකරයට සූදානම්ද?",
  "cta.button": "මගේ සංචාරය සැලසුම් කරන්න",
  "footer.tagline": "ශ්‍රී ලංකාවේ තේ රටේ කුඩා කණ්ඩායම් සංචාර.",
};
