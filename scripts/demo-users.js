const DEMO_SEED = "skillconnect-demo-users-v1";

// Original SVG avatars are embedded in the profile URL. No external image host is needed.
const avatar = ({ background, accent, skin, hair, shirt, longHair = false, glasses = false }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${accent}" stop-opacity=".4"/></linearGradient></defs>
    <rect width="640" height="480" fill="url(#bg)"/>
    <circle cx="75" cy="100" r="100" fill="white" opacity=".2"/><circle cx="590" cy="430" r="160" fill="white" opacity=".2"/>
    <path d="M155 480c0-155 330-155 330 0" fill="${shirt}"/>
    ${longHair ? `<path d="M224 252c-24-164 215-176 198 4l20 117H202z" fill="${hair}"/>` : ""}
    <rect x="291" y="299" width="58" height="68" rx="25" fill="${skin}"/>
    <ellipse cx="320" cy="240" rx="81" ry="99" fill="${skin}"/>
    <path d="M239 229c-29-99 49-130 98-115 59-9 90 57 66 116l-22-57c-32 23-77 10-99 9z" fill="${hair}"/>
    <ellipse cx="289" cy="243" rx="6" ry="8" fill="#223340"/><ellipse cx="350" cy="243" rx="6" ry="8" fill="#223340"/>
    ${glasses ? '<g fill="none" stroke="#293644" stroke-width="5"><rect x="263" y="225" width="50" height="35" rx="12"/><rect x="326" y="225" width="50" height="35" rx="12"/><path d="M313 237h13"/></g>' : ""}
    <path d="M305 281q15 12 30 0" fill="none" stroke="#9a5145" stroke-width="5" stroke-linecap="round"/>
    <path d="M281 356l39 33 39-33" fill="none" stroke="white" stroke-opacity=".55" stroke-width="6"/>
    <rect x="270" y="432" width="100" height="27" rx="13" fill="white" opacity=".16"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const demoUsers = [
  {
    name: "Alex Morgan", email: "alex.morgan@demo.skillconnect.test", dateOfBirth: "1998-04-16",
    bio: "Frontend developer who enjoys turning ideas into clean, accessible interfaces. Looking for people to build useful side projects with.",
    skills: ["React", "Next.js", "TypeScript", "Tailwind CSS"], experienceLevel: "Intermediate",
    interests: ["Open source", "UI design", "Accessibility"],
    profileImageUrl: avatar({ background: "#d5f4f6", accent: "#6cced9", skin: "#edbc95", hair: "#44332d", shirt: "#087f9b" }),
  },
  {
    name: "Priya Sharma", email: "priya.sharma@demo.skillconnect.test", dateOfBirth: "1996-09-08",
    bio: "Backend engineer working with Node.js and MongoDB. I like reliable APIs, thoughtful code reviews, and helping developers learn system design.",
    skills: ["Node.js", "Express", "MongoDB", "Docker"], experienceLevel: "Advanced",
    interests: ["System design", "Mentoring", "Developer tools"],
    profileImageUrl: avatar({ background: "#ece3fb", accent: "#ba9ae4", skin: "#c88d65", hair: "#25222e", shirt: "#7860b1", longHair: true }),
  },
  {
    name: "Sam Patel", email: "sam.patel@demo.skillconnect.test", dateOfBirth: "2003-02-21",
    bio: "Learning web development one project at a time. Currently building small JavaScript apps and looking for a friendly study or coding partner.",
    skills: ["JavaScript", "HTML", "CSS", "React"], experienceLevel: "Beginner",
    interests: ["Learning together", "Hackathons", "Web development"],
    profileImageUrl: avatar({ background: "#fff0d2", accent: "#efc268", skin: "#c8956d", hair: "#302c2a", shirt: "#b36d31", glasses: true }),
  },
  {
    name: "Maya Chen", email: "maya.chen@demo.skillconnect.test", dateOfBirth: "1999-07-12",
    bio: "Python developer exploring practical AI and data tools. Happy to team up on dashboards, automation, or a small machine learning project.",
    skills: ["Python", "FastAPI", "PostgreSQL", "Pandas"], experienceLevel: "Intermediate",
    interests: ["AI", "Data visualization", "Automation"],
    profileImageUrl: avatar({ background: "#dff3e7", accent: "#89c9aa", skin: "#efc5a2", hair: "#292c32", shirt: "#32856c", longHair: true, glasses: true }),
  },
  {
    name: "Jordan Brooks", email: "jordan.brooks@demo.skillconnect.test", dateOfBirth: "1995-11-03",
    bio: "Full stack developer interested in developer tools and cloud infrastructure. Looking for collaborators who enjoy shipping and improving real projects.",
    skills: ["TypeScript", "Go", "React", "AWS"], experienceLevel: "Advanced",
    interests: ["Cloud computing", "Open source", "Side projects"],
    profileImageUrl: avatar({ background: "#dce9fc", accent: "#91b4ec", skin: "#986346", hair: "#24232b", shirt: "#3f669f" }),
  },
];

module.exports = { DEMO_SEED, demoUsers };
