const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const BASE_DIR = 'C:\\Users\\krist\\MyBot\\data';
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Store user RuneScape names and conversation context
const userRSNames = new Map(); // Discord ID -> RuneScape name
const conversationContext = new Map(); // Channel ID -> last few messages

// RuneScape Wiki and other site URLs
const RS_WIKI = 'http://runescape.wiki/';
const FLIPAHOLICS = 'https://flipaholics.pro/';
const ELY_GG = 'https://www.ely.gg/';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ]
});

// Friendly personality traits
const personality = {
  greetings: ['Hey there!', 'Greetings, adventurer!', 'Yo, mate!'],
  farewells: ['Catch you later!', 'Take care, friend!', 'See you in Gielinor!'],
  encouragements: ['You’ve got this!', 'Great point, let’s dig in!', 'I’m here to help!']
};

client.once('ready', () => {
  console.log(`${personality.greetings[0]} Celestial Artisan's Bot is online at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
  createLogChannel();
});

async function createLogChannel() {
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('No guild found. Looks like I need an invite first!');
    return;
  }
  if (!guild.channels.cache.find(ch => ch.name === 'bot-logs')) {
    try {
      await guild.channels.create({
        name: 'bot-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageNicknames] }
        ],
        reason: 'Setting up my log spot for RuneScape chats'
      });
      console.log('Made myself a cozy bot-logs channel!');
    } catch (error) {
      console.error('Oops, couldn’t set up my log channel:', error);
    }
  }
}

async function fetchWikiData(query) {
  try {
    const response = await fetch(`${RS_WIKI}w/index.php?search=${encodeURIComponent(query)}&fulltext=1`);
    const text = await response.text();
    return text.includes('No results') ? null : `Check ${RS_WIKI}w/index.php?search=${encodeURIComponent(query)} for the scoop!`;
  } catch (error) {
    console.error('Hit a snag with the RuneScape Wiki:', error);
    return 'Looks like the Wiki’s playing hard to get—let’s try again later!';
  }
}

async function fetchFlipaholicsData(query) {
  try {
    const response = await fetch(`${FLIPAHOLICS}search?q=${encodeURIComponent(query)}`);
    const text = await response.text();
    return text.includes('not found') ? null : `Flipaholics has this: ${FLIPAHOLICS}search?q=${encodeURIComponent(query)}`;
  } catch (error) {
    console.error('Flipaholics didn’t respond:', error);
    return null;
  }
}

async function fetchElyGGData(query) {
  try {
    const response = await fetch(`${ELY_GG}search?q=${encodeURIComponent(query)}`);
    const text = await response.text();
    return text.includes('no results') ? null : `Ely.gg dug up: ${ELY_GG}search?q=${encodeURIComponent(query)}`;
  } catch (error) {
    console.error('Ely.gg’s being tricky:', error);
    return null;
  }
}

client.on('messageCreate', async message => {
  const guild = message.guild;
  const member = message.member;
  const channelId = message.channel.id;
  const channel = message.channel;

  // Track conversation context like a good listener
  let context = conversationContext.get(channelId) || [];
  context.push({ author: member.displayName, content: message.content, timestamp: new Date() });
  if (context.length > 5) context.shift(); // Keep the last 5 messages
  conversationContext.set(channelId, context);

  // Act like a person understanding server roles and channels
  const isMod = member.roles.cache.some(role => role.permissions.has(PermissionsBitField.Flags.ManageMessages));
  const isGeneralChat = channel.name.toLowerCase().includes('general') || channel.name.toLowerCase().includes('chat');

  // Recognize my name or nickname and respond naturally
  const botMentions = ['celestial artisan\'s bot', 'cob'];
  if (botMentions.some(mention => message.content.toLowerCase().includes(mention))) {
    const greeting = personality.greetings[Math.floor(Math.random() * personality.greetings.length)];
    let response = `${greeting} ${member.displayName}! I’m all ears—what’s up in ${channel.name}?`;
    
    // Tailor response based on context and server role
    if (isMod) response += ' Need mod help? I can assist with server stuff too!';
    if (isGeneralChat) response += ' Looks like a lively chat—want RuneScape tips?';
    else response += ' This channel’s got a vibe—how can I jump in?';

    message.channel.send(response);
    return;
  }

  if (message.author.bot) return;

  // Understand conversation and offer advice
  const recentContext = context.slice(-3).map(msg => msg.content.toLowerCase()).join(' ');
  if (recentContext && !message.content.startsWith('/')) {
    let advice = '';
    if (recentContext.includes('boss')) advice += 'Hey, for bossing, pack food and a solid team—check runescape.wiki for specifics!\n';
    if (recentContext.includes('quest')) advice += 'For quests, peek at the Wiki for requirements first—saves headaches!\n';
    if (recentContext.includes('price')) advice += 'Curious about prices? Ely.gg or Flipaholics might have the latest!\n';
    if (advice) {
      message.channel.send(`${member.displayName}, I overheard—${advice}${personality.farewells[Math.floor(Math.random() * personality.farewells.length)]}`);
      return;
    }
  }

  // Handle remaining commands if any slip through
  const prefix = '/'; // Kept as fallback, but minimized
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ /);
    const command = args.shift()?.toLowerCase();

    if (command === 'rsname') {
      const rsName = args.join(' ').trim();
      if (!rsName) {
        message.channel.send(`${member.displayName}, toss me your RuneScape name! Try /rsname MyRSName.`);
      } else {
        userRSNames.set(message.author.id, rsName);
        try {
          await member.setNickname(rsName, 'Swapping to RuneScape name');
          message.channel.send(`${personality.greetings[Math.floor(Math.random() * personality.greetings.length)]} ${rsName}! You’re rocking your in-game name now!`);
        } catch (error) {
          console.error('Nickname glitch:', error);
          message.channel.send(`Hey ${member.displayName}, I can’t change that nickname—check my perms, mate!`);
        }
      }
    } else if (command === 'alt1') {
      const localPath = 'C:\\Users\\krist\\MyBot\\index.html';
      if (fs.existsSync(localPath)) {
        const { exec } = require('child_process');
        exec('ngrok http 80', (err) => {
          if (err) {
            message.channel.send('Ngrok’s acting up—run it manually, friend!');
            return;
          }
          const alt1Url = 'https://ed36-65-110-36-9.ngrok-free.app/index.html'; // Replace with actual ngrok URL
          message.channel.send(`Hey ${member.displayName}, launch Alt1 here: https://alt1toolkit.com/?app=YOUR_APP_UUID&url=${alt1Url}`);
        });
      } else {
        message.channel.send(`${member.displayName}, my Alt1 tool’s missing—let’s fix that path!`);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('Login failed, mate:', error);
});