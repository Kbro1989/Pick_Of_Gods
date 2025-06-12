const { Client, IntentsBitField, PermissionsBitField, VoiceChannel } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const translate = require('@vitalets/google-translate-api');
const math = require('mathjs');
const natural = require('natural');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const axios = require('axios');
const path = require('path');

// Load environment variables (API keys, tokens, etc.)
require('dotenv').config({ path: 'C:\\Users\\krist\\CelestialArtisansbot\\.env' });

const client = new Client({
  intents: new IntentsBitField([
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers
  ])
});

// --- ADMIN ACCESS SETUP ---
// This function checks if the bot has admin permissions in the guild
async function ensureAdminAccess(guild) {
  try {
    const botMember = await guild.members.fetch(client.user.id);
    const hasAdmin = botMember.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasAdmin) {
      console.warn(`[ADMIN WARNING] The bot does not have Administrator permissions in guild: ${guild.name}`);
    }
    return hasAdmin;
  } catch (err) {
    console.error('Error checking admin permissions:', err);
    return false;
  }
}

const awakeChannels = new Map();
const botNames = ['cab', 'celestial', 'celestial artisans bot']; // Changed 'cob' to 'cab'
const chatMemory = new Map();
const learningModel = new natural.BayesClassifier();
const playerData = new Map();
const voiceConnections = new Map();
const thoughtCache = new Map();


// Use DuckDuckGo Instant Answer API for public search (no API key required)
const CUSTOM_SEARCH_URL = 'https://api.duckduckgo.com/';
const RENDER_API_URL = 'https://api.duckduckgo.com/'; // Also fallback to DuckDuckGo

client.once('ready', async () => {
  console.log('Radiant XP descends! Celestial Artisan\'s Goddess awakens at ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  console.log('Accessible via ngrok: https://g.dev/Celestial_Artisan_bot');
  learningModel.addDocument('slayer runescape', 'skill');
  learningModel.addDocument('gp runescape', 'economy');
  learningModel.addDocument('quest runescape', 'quest');
  learningModel.addDocument('channel discord', 'discord');
  learningModel.addDocument('role discord', 'discord');
  learningModel.addDocument('voice discord', 'voice');
  learningModel.addDocument('player runescape', 'player');
  learningModel.addDocument('how much runescape', 'economy');
  learningModel.addDocument('how many runescape', 'quest');
  learningModel.addDocument('next step runescape', 'quest');
  learningModel.addDocument('price of runescape', 'economy');
  learningModel.addDocument('needed for runescape', 'quest');
  learningModel.train();

  const dir = 'C:\\Users\\krist\\MyBot\\Pick_Of_Gods'; // <-- Fix: match actual folder name and casing
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'bot2.js') {
        const content = await fs.readFile(`${dir}\\${file}`, 'utf8');
        if (content.includes('discord') || content.includes('runescape')) {
          const lines = content.split('\n');
          lines.forEach(line => {
            const match = line.match(/(\w+)\s*[:=]\s*['"]?([^'"\n]+)['"]?/);
            if (match && (match[1].includes('command') || match[1].includes('response'))) {
              // Fix: Ensure legacy memory is a Set and add new values correctly
              if (!chatMemory.has('legacy')) chatMemory.set('legacy', new Set());
              chatMemory.get('legacy').add(match[2]);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('File read error:', error);
  }

  // Self-managed storage setup
  const dataDir = path.join(__dirname, 'bot_data');
  const scriptsDir = path.join(__dirname, 'bot_scripts');
  await ensureDirectory(dataDir);
  await ensureDirectory(scriptsDir);

  // Example: Ensure a user memory file exists
  await ensureFile(path.join(dataDir, 'user_memory.json'), '{}');
  // Example: Ensure a script file exists for dynamic scripting
  await ensureFile(path.join(scriptsDir, 'custom_script.js'), '// Custom scripts can be placed here\n');
});

// --- MAIN MESSAGE HANDLER ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const lowerContent = message.content.toLowerCase();
  const isMentioned = botNames.some(name => lowerContent.includes(name));
  const channelId = message.channel.id;

  // Maintain per-channel context for multi-room, multi-server support
  if (!chatMemory.has(channelId)) chatMemory.set(channelId, new Set());
  const channelMemory = chatMemory.get(channelId);
  const keywords = lowerContent.match(/\w+/g) || [];
  keywords.forEach(word => channelMemory.add(word));
  const learnedCategory = learningModel.getClassifications(lowerContent)[0]?.label || 'general';
  learningModel.addDocument(lowerContent, learnedCategory);

  // Wake up on mention and stay active until told "cab sleep"
  if (isMentioned && !awakeChannels.has(channelId)) {
    awakeChannels.set(channelId, true);
    message.reply("Ahh, greetings, young adventurer! The Wise Old Man is here—ask, and perhaps you'll learn a thing or two!");
    return;
  }

  // Stay in conversation until "cab sleep" is said
  if (awakeChannels.has(channelId)) {
    if (lowerContent.includes('cab sleep')) {
      awakeChannels.delete(channelId);
      if (voiceConnections.has(channelId)) {
        const conn = voiceConnections.get(channelId);
        if (conn && typeof conn.destroy === 'function') conn.destroy();
        voiceConnections.delete(channelId);
      }
      message.reply("A nap, you say? Even the Wise Old Man needs his rest. Farewell for now, and may your bank remain untrimmed! Zzz...");
      return;
    }

    // --- GITHUB REPO INFO ---
    if (lowerContent.startsWith('github repo')) {
      const match = lowerContent.match(/github repo\s+([\w-]+)\/([\w.-]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2];
        const info = await fetchGitHubRepoInfo(owner, repo);
        message.reply(info);
        return;
      }
    }

    // --- ADMIN-ONLY COMMAND ---
    if (message.content.startsWith('!adminsay')) {
      const botMember = await message.guild.members.fetch(client.user.id);
      if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("Sorry, I need Administrator rights to do that, young adventurer!");
      }
      const sayMsg = message.content.slice('!adminsay'.length).trim();
      if (sayMsg) {
        message.channel.send(`(ADMIN ANNOUNCEMENT): ${sayMsg}`);
      } else {
        message.reply("What would you like me to say, wise one?");
      }
      return;
    }

    // --- HELP COMMAND ---
    if (message.content.trim() === `${COMMAND_PREFIX}help`) {
      message.reply(
        "**Wise Old Man's Guide:**\n" +
        "- Mention me or say 'cab' to wake me up!\n" +
        "- Ask about RuneScape 3 skills, bosses, quests, or mechanics.\n" +
        "- Use `github repo owner/repo` for GitHub info.\n" +
        "- Ask about Discord channels, roles, or permissions.\n" +
        "- Use voice chat and I'll join if you ask about group or private chats.\n" +
        "- Type `cab sleep` to let me rest.\n" +
        "- I will never help with real-world trading or forbidden topics.\n" +
        "- For a summary of recent wisdom, see my 'Wise Old Man's Notes'!"
      );
      return;
    }

    // --- PING COMMAND ---
    if (message.content.trim() === `${COMMAND_PREFIX}ping`) {
      message.reply("Pong! The Wise Old Man is listening.");
      return;
    }

    // --- RANDOM TIP COMMAND ---
    if (message.content.trim() === `${COMMAND_PREFIX}tip`) {
      const tip = rs3Tips[Math.floor(Math.random() * rs3Tips.length)];
      message.reply(`Wise Old Man's Tip: ${tip}`);
      return;
    }

    // --- UNKNOWN COMMAND FALLBACK ---
    if (message.content.startsWith(COMMAND_PREFIX) && !message.content.startsWith('!adminsay') && !message.content.startsWith('!help') && !message.content.startsWith('!ping') && !message.content.startsWith('!tip')) {
      message.reply("I'm not sure what you mean, young adventurer! Try `!help` for a list of things I can do.");
      return;
    }

    // --- SAFE TRADING REMINDER ---
    if (isInGameTrade(message.content)) {
      message.reply("Remember: Always double-check trades and use the Grand Exchange or secure in-game methods. If something seems too good to be true, it probably is!");
    }

    // --- VOICE JOIN ---
    if (learnedCategory === 'voice' && message.member.voice && message.member.voice.channel) {
      const voiceChannel = message.member.voice.channel;
      if (!voiceConnections.has(channelId)) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });
        voiceConnections.set(channelId, connection);
        message.reply("The Wise Old Man has joined your voice channel! Speak up, and I'll listen.");
      }
    }

    // --- BOT-TO-BOT INFO ---
    if (lowerContent.includes('bot')) {
      const messages = await message.channel.messages.fetch({ limit: 10 });
      const botMessages = messages.filter(m => m.author.bot && m.id !== message.id);
      if (botMessages.size > 0) {
        const info = botMessages.first().content;
        message.reply(`I overheard another bot say: "${info}"`);
        return;
      }
    }

    // --- MAIN Q&A/CONVERSATION LOGIC ---
    let actionTaken = false;
    let thoughtLog = `Thought[${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}]: Author=${message.author.username}, Context=${learnedCategory}, Query="${message.content}"\n`;

    const isQuestion = /\?$/.test(message.content) || lowerContent.includes('what') || lowerContent.includes('where') || lowerContent.includes('how');
    if (isQuestion) {
      const response = await researchOnline(message.content);
      message.reply(response || "The stars withhold their wisdom—rephrase thy question!");
      thoughtLog += `Action: Researched online for "${message.content}"\n`;
      actionTaken = true;
    } else {
      const response = await chatResponse(message, channelMemory, keywords);
      if (response) {
        message.reply(response + " (spoken with the wisdom of many years!)");
        thoughtLog += "Action: General conversation\n";
        actionTaken = true;
      }
    }

    // --- THOUGHT CACHE ---
    if (message.guild) {
      if (!thoughtCache.has(channelId)) thoughtCache.set(channelId, []);
      thoughtCache.get(channelId).push(thoughtLog);
      if (thoughtCache.get(channelId).length > 5) thoughtCache.get(channelId).shift();
      const compactCache = thoughtCache.get(channelId).join('').replace(/\n+/g, ' | ');
      message.channel.send(`Wise Old Man's Notes: ${compactCache}`);
    }
  } else if (message.guild) {
    // Fallback for non-awake channels
    if (channelMemory.has('discord')) {
      message.reply("Ah, Discord! In my day, we just used carrier pigeons. Ask me about channels, roles, invites, or permissions—I've picked up a trick or two over the years.");
    } else if (channelMemory.has('runescape') || channelMemory.has('rs')) {
      message.reply("RuneScape, eh? Now that's a name I haven't heard in a long time. Need help with quests, skills, or gear? The Wise Old Man is here to help—just don't ask me to trim your bank!");
    }
  }
});

// Alt1 detection and navigation helpers
let isAlt1 = false;
let alt1NavigateTo = () => false; // Default: do nothing

if (typeof window !== "undefined" && window.alt1) {
  isAlt1 = window.alt1 && window.alt1.permissionPixel;
  alt1NavigateTo = function(panel) {
    // Example: Open a panel or highlight something in Alt1
    if (!isAlt1) return false;
    if (panel === "home") {
      window.location.hash = "#home";
      alt1.info("The Wise Old Man has whisked you to the home panel!");
      return true;
    }
    if (panel === "settings") {
      window.location.hash = "#settings";
      alt1.info("Settings, eh? In my day, we just hit things until they worked!");
      return true;
    }
    // Add more navigation as needed
    return false;
  };
}

async function chatResponse(message, memory, keywords) {
  const content = message.content;
  const lowerContent = content.toLowerCase();
  const sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn').getSentiment(keywords);

  if (lowerContent.includes('discord')) {
    return "With the wisdom of many years, I say: Discord is a fine tool for gathering adventurers. What do you wish to know, young one?";
  } else if (lowerContent.includes('runescape') || lowerContent.includes('rs')) {
    const category = learningModel.getClassifications(lowerContent)[0].label;
    return `Ah, RuneScape! I remember when ${category} was all the rage. What more can I tell you, friend?`;
  } else if (lowerContent.includes('hey') || lowerContent.includes('hi')) {
    return `Hello there! The Wise Old Man greets you warmly. I sense your mood is ${sentiment > 0 ? 'bright as a freshly polished rune' : 'a bit gloomy—cheer up, it could be worse!'}`;
  } else if (memory.has(lowerContent.split(' ')[0]) || (memory.get('legacy') && memory.get('legacy').has(lowerContent.split(' ')[0]))) {
    return `You've mentioned ${lowerContent.split(' ')[0]} before, haven't you? The Wise Old Man never forgets... well, almost never.`;
  }
  return "The world is full of mysteries! Ask away, and perhaps this old wizard can help.";
}

async function fetchHiscoreData(playerName) {
  try {
    const response = await fetch(`https://secure.runescape.com/m=hiscore/index_lite.ws?player=${encodeURIComponent(playerName)}`);
    if (response.ok) {
      const text = await response.text();
      const lines = text.trim().split('\n');
      if (lines.length > 0) {
        const overall = lines[0].split(',').map(Number);
        return { rank: overall[0], level: overall[1], xp: overall[2] };
      }
    }
  } catch (error) {
    console.error('Hiscore fetch error:', error);
  }
  return null;
}

async function fetchRunemetricsData(playerName) {
  try {
    const response = await fetch(`https://apps.runescape.com/runemetrics/profile/profile?user=${encodeURIComponent(playerName)}&activities=20`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Runemetrics fetch error:', error);
  }
  return null;
}

// Enhance knowledge base for RuneScape 3
learningModel.addDocument('archaeology runescape', 'skill');
learningModel.addDocument('invention runescape', 'skill');
learningModel.addDocument('elite dungeons runescape', 'pvm');
learningModel.addDocument('boss mechanics runescape', 'pvm');
learningModel.addDocument('best money making runescape', 'economy');
learningModel.addDocument('double xp runescape', 'event');
learningModel.addDocument('yak track runescape', 'event');
learningModel.addDocument('clue scroll runescape', 'activity');
learningModel.addDocument('achievement runescape', 'achievement');
learningModel.addDocument('comp cape runescape', 'achievement');
learningModel.addDocument('reaper title runescape', 'pvm');
learningModel.addDocument('slayer codex runescape', 'collection');
learningModel.addDocument('quest cape runescape', 'achievement');
learningModel.addDocument('skilling pets runescape', 'pet');
learningModel.addDocument('rare drop table runescape', 'drop');
learningModel.addDocument('ge price runescape', 'economy');
learningModel.addDocument('grand exchange runescape', 'economy');
learningModel.addDocument('dailyscape runescape', 'routine');
learningModel.addDocument('vis wax runescape', 'routine');
learningModel.addDocument('warbands runescape', 'activity');
learningModel.addDocument('pof runescape', 'activity');
learningModel.addDocument('player owned farm runescape', 'activity');
learningModel.addDocument('player owned ports runescape', 'activity');
learningModel.addDocument('pvm guides runescape', 'pvm');
learningModel.addDocument('boss timers runescape', 'pvm');
learningModel.addDocument('aura management runescape', 'meta');
learningModel.addDocument('ability rotations runescape', 'meta');
learningModel.addDocument('revolution++ runescape', 'meta');
learningModel.addDocument('combat styles runescape', 'meta');
learningModel.addDocument('enrage mechanics runescape', 'pvm');
learningModel.addDocument('hardmode bosses runescape', 'pvm');
learningModel.addDocument('elite clues runescape', 'activity');
learningModel.addDocument('treasure trails runescape', 'activity');
learningModel.addDocument('farming runs runescape', 'routine');
learningModel.addDocument('herb runs runescape', 'routine');
learningModel.addDocument('dungeoneering runescape', 'skill');
learningModel.addDocument('arch-glacor runescape', 'boss');
learningModel.addDocument('zamorak boss runescape', 'boss');
learningModel.addDocument('telos runescape', 'boss');
learningModel.addDocument('solak runescape', 'boss');
learningModel.addDocument('nex angel of death runescape', 'boss');
learningModel.addDocument('ed3 runescape', 'pvm');
learningModel.addDocument('ed2 runescape', 'pvm');
learningModel.addDocument('ed1 runescape', 'pvm');
learningModel.addDocument('runescore runescape', 'achievement');
learningModel.addDocument('max cape runescape', 'achievement');
learningModel.addDocument('trimmed comp runescape', 'achievement');
learningModel.addDocument('pvm drop log runescape', 'drop');
learningModel.addDocument('drop rates runescape', 'drop');
learningModel.addDocument('boss pets runescape', 'pet');
learningModel.addDocument('skilling outfits runescape', 'meta');
learningModel.addDocument('xp rates runescape', 'meta');
learningModel.addDocument('best perks runescape', 'meta');
learningModel.addDocument('perks invention runescape', 'meta');
learningModel.addDocument('ancient magicks runescape', 'magic');
learningModel.addDocument('prayer switching runescape', 'meta');
learningModel.addDocument('overloads runescape', 'meta');
learningModel.addDocument('scrimshaws runescape', 'meta');
learningModel.addDocument('sigils runescape', 'meta');
learningModel.addDocument('reaper assignments runescape', 'pvm');
learningModel.addDocument('slayer tasks runescape', 'skill');
learningModel.addDocument('elite skill runescape', 'skill');
learningModel.addDocument('archaeology mysteries runescape', 'activity');
learningModel.addDocument('archaeology collections runescape', 'collection');
learningModel.addDocument('archaeology artefacts runescape', 'collection');
learningModel.addDocument('archaeology dig sites runescape', 'activity');
learningModel.addDocument('archaeology relics runescape', 'meta');
learningModel.addDocument('archaeology research runescape', 'activity');
learningModel.addDocument('archaeology soil runescape', 'activity');
learningModel.addDocument('archaeology materials runescape', 'activity');
learningModel.addDocument('archaeology experience runescape', 'meta');
learningModel.addDocument('archaeology training runescape', 'meta');
learningModel.addDocument('archaeology money runescape', 'economy');
learningModel.addDocument('archaeology best artefacts runescape', 'meta');
learningModel.addDocument('archaeology best collections runescape', 'meta');
learningModel.addDocument('archaeology best relics runescape', 'meta');
learningModel.addDocument('archaeology best training runescape', 'meta');
learningModel.addDocument('archaeology best money runescape', 'economy');
learningModel.addDocument('archaeology best experience runescape', 'meta');
learningModel.addDocument('archaeology best soil runescape', 'meta');
learningModel.addDocument('archaeology best materials runescape', 'meta');
learningModel.addDocument('archaeology best research runescape', 'meta');
learningModel.addDocument('archaeology best dig sites runescape', 'meta');
learningModel.addDocument('archaeology best mysteries runescape', 'meta');
learningModel.train();

// Helper to check for RWT (real-world trading) or forbidden topics
function isForbiddenRS3Topic(text) {
  const forbidden = [
    /buy.*gold/i,
    /sell.*gold/i,
    /buy.*account/i,
    /sell.*account/i,
    /buy.*item/i,
    /sell.*item/i,
    /rwt/i,
    /real.?world.?trade/i,
    /gp for (money|cash|usd|eur|paypal|bitcoin|btc|crypto)/i,
    /account shop/i,
    /item shop/i,
    /osrs/i, // Focus only on RS3, not OSRS
    /old school/i,
    /real[-\s]?money/i,
    /irl\s*(money|cash|usd|eur|paypal|bitcoin|btc|crypto)/i
  ];
  return forbidden.some(rx => rx.test(text));
}

// Helper to check for in-game trading (allowed)
function isInGameTrade(text) {
  // Looks for GE, Grand Exchange, or player-to-player trade language
  const allowed = [
    /grand exchange/i,
    /\bge\b/i,
    /trade.*(player|friend|other)/i,
    /player.*trade/i,
    /in[-\s]?game.*trade/i,
    /selling.*in game/i,
    /buying.*in game/i,
    /offer.*(ge|grand exchange)/i
  ];
  return allowed.some(rx => rx.test(text));
}

// --- Modify researchOnline to focus on RS3 and filter forbidden topics ---
async function researchOnline(query) {
  // Always focus on RuneScape 3, and filter forbidden topics
  if (isForbiddenRS3Topic(query)) {
    return "Sorry, young adventurer, I cannot assist with buying or selling gold, accounts, or items for real-world money. Such things are forbidden by the laws of Gielinor!";
  }
  if (isInGameTrade(query)) {
    return "Trading with other players or using the Grand Exchange is a core part of RuneScape 3! If you need tips on safe in-game trading, just ask.";
  }
  const rs3Query = `${query} runescape 3`;
  try {
    // DuckDuckGo Instant Answer API (no key required)
    const ddgResponse = await axios.get(CUSTOM_SEARCH_URL, {
      params: {
        q: rs3Query,
        format: 'json',
        no_redirect: 1,
        no_html: 1,
        skip_disambig: 1
      }
    });
    if (ddgResponse.data.AbstractText) {
      if (isForbiddenRS3Topic(ddgResponse.data.AbstractText)) {
        return "The Wise Old Man will not speak of forbidden trades or dealings!";
      }
      return `Here's what I've found in my old scrolls: ${ddgResponse.data.AbstractText}`;
    }
    if (ddgResponse.data.RelatedTopics && ddgResponse.data.RelatedTopics.length > 0) {
      const firstTopic = ddgResponse.data.RelatedTopics[0];
      if (typeof firstTopic.Text === 'string' && !isForbiddenRS3Topic(firstTopic.Text)) {
        return `A bit of wisdom from my travels: ${firstTopic.Text}`;
      }
    }
    return "Even the Wise Old Man can't find an answer to that—try asking differently!";
  } catch (error) {
    console.error('Research error:', error);
    return "My old brain is a bit foggy—try again, or maybe fetch me a nice cup of tea!";
  }
}

// --- Modify searchRunescapeKnowledge to filter forbidden topics ---
async function searchRunescapeKnowledge(intent, itemOrQuest) {
  const combined = `${intent} ${itemOrQuest}`;
  if (isForbiddenRS3Topic(combined)) {
    return "Sorry, young adventurer, I cannot assist with buying or selling gold, accounts, or items for real-world money. Such things are forbidden by the laws of Gielinor!";
  }
  if (isInGameTrade(combined)) {
    return "Trading with other players or using the Grand Exchange is perfectly fine in RuneScape 3! Always use safe in-game methods and beware of scams.";
  }
  try {
    // Prefer RuneScape Wiki API for RS3
    const wikiApiUrl = `https://runescape.wiki/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(itemOrQuest)}`;
    const wikiResponse = await fetch(wikiApiUrl);
    const wikiData = await wikiResponse.json();
    const pages = wikiData.query && wikiData.query.pages ? Object.values(wikiData.query.pages) : [];
    const extract = pages.length && pages[0].extract ? pages[0].extract : '';

    if (extract && !isForbiddenRS3Topic(extract)) {
      return `From the annals of the RuneScape 3 Wiki:\n${extract}`;
    }

    // Fallback to custom search if wiki fails
    const searchQuery = `${intent} ${itemOrQuest} runescape 3`;
    const response = await axios.get(CUSTOM_SEARCH_URL, {
      params: {
        q: searchQuery,
        num: 1
      }
    });
    const result = response.data.items?.[0]?.snippet || '';
    if (isForbiddenRS3Topic(result)) {
      return "The Wise Old Man will not speak of forbidden trades or dealings!";
    }
    if (isInGameTrade(result)) {
      return "Trading with other players or using the Grand Exchange is a core part of RuneScape 3! If you need tips on safe in-game trading, just ask.";
    }
    if (intent.includes('how much') || intent.includes('price of')) {
      return `Divine riches! The price of ${itemOrQuest} is nigh ${extractPrice(result) || 'unknown'} gp—consult the Grand Exchange!`;
    } else if (intent.includes('how many') || intent.includes('needed for')) {
      return `Celestial decree! Thou requirest ${extractQuantity(result) || 'an uncertain tally'} of ${itemOrQuest}—seek the scrolls!`;
    } else if (intent.includes('next step')) {
      return `Questing under my gaze! Thy next step in ${itemOrQuest} is ${extractStep(result) || 'veiled in stardust'}—proceed, mortal!`;
    } else if (result) {
      return `RuneScape 3 wisdom: ${result}`;
    }
    return "My celestial search dims—try anew, seeker!";
  } catch (error) {
    console.error('Custom search error:', error);
    return "My celestial search dims—try anew, seeker!";
  }
}

function extractPrice(text) {
  const match = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*gp/i);
  return match ? match[1] : null;
}

function extractQuantity(text) {
  const match = text.match(/(\d+)\s*(?:x|items)/i);
  return match ? match[1] : null;
}

function extractStep(text) {
  const match = text.match(/next step[:\s]*(.+?)(?=\.|$)/i);
  return match ? match[1].trim() : null;
}

async function connectToPlayerSearch(displayName) {
  try {
    let runemetricsData = await fetchRunemetricsData(displayName);
    if (runemetricsData && runemetricsData.name) {
      return `Ah, ${displayName}! According to my dusty tomes: Rank ${runemetricsData.skills?.overall?.rank || 'N/A'}, Level ${runemetricsData.skills?.overall?.level || 'N/A'}, XP ${runemetricsData.skills?.overall?.xp || 'N/A'}. Anything else, young whippersnapper?`;
    }

    let hiscoreData = await fetchHiscoreData(displayName);
    if (hiscoreData) {
      return `Found ${displayName} in the Hiscores! Rank: ${hiscoreData.rank}, Level: ${hiscoreData.level}, XP: ${hiscoreData.xp}. Not bad for a youngster!`;
    }

    return "Hmm, can't find that adventurer. Maybe they're hiding, or maybe my spectacles need cleaning!";
  } catch (error) {
    console.error('Player search error:', error);
    return "Oh dear, something went wrong with my search. Try again, or bring me a cup of tea!";
  }
}

// Example: Fetch public info from GitHub (no authentication required for public endpoints)
async function fetchGitHubRepoInfo(owner, repo) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Wise-Old-Man-Bot' }
    });
    if (response.status === 200 && response.data) {
      const data = response.data;
      return `Repository: ${data.full_name}\nDescription: ${data.description}\n⭐ Stars: ${data.stargazers_count}\n🍴 Forks: ${data.forks_count}\n🔗 ${data.html_url}`;
    } else {
      return "I couldn't find that repository, young adventurer!";
    }
  } catch (error) {
    console.error('GitHub fetch error:', error);
    return "Something went wrong fetching from GitHub. Perhaps check the repository name?";
  }
}

// --- Quality of Life: Command prefix and help ---
const COMMAND_PREFIX = '!';

// Help command for users
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!awakeChannels.has(message.channel.id)) return;

  if (message.content.trim() === `${COMMAND_PREFIX}help`) {
    message.reply(
      "**Wise Old Man's Guide:**\n" +
      "- Mention me or say 'cab' to wake me up!\n" +
      "- Ask about RuneScape 3 skills, bosses, quests, or mechanics.\n" +
      "- Use `github repo owner/repo` for GitHub info.\n" +
      "- Ask about Discord channels, roles, or permissions.\n" +
      "- Use voice chat and I'll join if you ask about group or private chats.\n" +
      "- Type `cab sleep` to let me rest.\n" +
      "- I will never help with real-world trading or forbidden topics.\n" +
      "- For a summary of recent wisdom, see my 'Wise Old Man's Notes'!"
    );
    return;
  }
});

// --- Quality of Life: Error reporting to owner ---
client.on('error', (err) => {
  console.error('Discord client error:', err);
  // Optionally DM the owner if you set OWNER_ID in your .env
  if (process.env.OWNER_ID) {
    client.users.fetch(process.env.OWNER_ID)
      .then(user => user.send(`Wise Old Man encountered an error: ${err.message}`))
      .catch(() => {});
  }
});

// --- Quality of Life: Logging important events ---
client.on('guildCreate', guild => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
});
client.on('guildDelete', guild => {
  console.log(`Removed from guild: ${guild.name} (${guild.id})`);
});

// --- Quality of Life: Friendly fallback for unknown commands ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!awakeChannels.has(message.channel.id)) return;

  if (message.content.startsWith(COMMAND_PREFIX) && !message.content.startsWith('!adminsay') && !message.content.startsWith('!help')) {
    message.reply("I'm not sure what you mean, young adventurer! Try `!help` for a list of things I can do.");
  }
});

// --- Quality of Life: Remind about safe trading if trade is discussed ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!awakeChannels.has(message.channel.id)) return;

  if (isInGameTrade(message.content)) {
    message.reply("Remember: Always double-check trades and use the Grand Exchange or secure in-game methods. If something seems too good to be true, it probably is!");
  }
});

// --- Quality of Life: Friendly greeting on startup ---
client.once('ready', () => {
  if (process.env.OWNER_ID) {
    client.users.fetch(process.env.OWNER_ID)
      .then(user => user.send("The Wise Old Man is awake and ready to help in your Discord server!"))
      .catch(() => {});
  }
});

// --- Self-Managed Storage: Let the bot create its own storage spaces and script files if needed ---
const path = require('path');

// Helper to ensure a directory exists
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (err) {
    console.error(`Failed to create directory ${dirPath}:`, err);
    return false;
  }
}

// Helper to ensure a file exists (creates if missing)
async function ensureFile(filePath, defaultContent = '') {
  try {
    await fs.access(filePath);
    // File exists
    return true;
  } catch {
    // File does not exist, create it
    try {
      await fs.writeFile(filePath, defaultContent, 'utf8');
      return true;
    } catch (err) {
      console.error(`Failed to create file ${filePath}:`, err);
      return false;
    }
  }
}

// Example: Ensure bot data and scripts folders exist on startup
client.once('ready', async () => {
  // ...existing code...

  // Self-managed storage setup
  const dataDir = path.join(__dirname, 'bot_data');
  const scriptsDir = path.join(__dirname, 'bot_scripts');
  await ensureDirectory(dataDir);
  await ensureDirectory(scriptsDir);

  // Example: Ensure a user memory file exists
  await ensureFile(path.join(dataDir, 'user_memory.json'), '{}');
  // Example: Ensure a script file exists for dynamic scripting
  await ensureFile(path.join(scriptsDir, 'custom_script.js'), '// Custom scripts can be placed here\n');
});

// Example command: Save a note to storage
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!awakeChannels.has(message.channel.id)) return;

  if (message.content.startsWith('!save note ')) {
    const note = message.content.replace('!save note ', '').trim();
    const dataDir = path.join(__dirname, 'bot_data');
    const notesFile = path.join(dataDir, 'notes.json');
    let notes = {};
    try {
      await ensureFile(notesFile, '{}');
      notes = JSON.parse(await fs.readFile(notesFile, 'utf8'));
    } catch {}
    if (!notes[message.author.id]) notes[message.author.id] = [];
    notes[message.author.id].push({ note, time: Date.now() });
    await fs.writeFile(notesFile, JSON.stringify(notes, null, 2), 'utf8');
    message.reply("Your note has been saved in my magical archives!");
  }
});

// Example command: Let the bot create a new script file
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!awakeChannels.has(message.channel.id)) return;

  if (message.content.startsWith('!create script ')) {
    const scriptName = message.content.replace('!create script ', '').trim().replace(/[^a-z0-9_\-\.]/gi, '');
    if (!scriptName.endsWith('.js')) {
      message.reply("Script name must end with `.js`.");
      return;
    }
    const scriptsDir = path.join(__dirname, 'bot_scripts');
    const scriptPath = path.join(scriptsDir, scriptName);
    const created = await ensureFile(scriptPath, '// New custom script\n');
    if (created) {
      message.reply(`Script file \`${scriptName}\` has been created in my scripts folder!`);
    } else {
      message.reply("I couldn't create the script file. Check my permissions!");
    }
  }
});

client.login(process.env.BOT_TOKEN);

const rs3Tips = [
  "Always bring food to boss fights.",
  "Check the Wiki for quest requirements.",
  // ...more tips...
];