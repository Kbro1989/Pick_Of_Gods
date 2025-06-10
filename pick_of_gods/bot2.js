const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

// Define base directory for logs and resources
const BASE_DIR = 'C:\\Users\\krist\\MyBot\\data'; // Adjust this path as needed

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildWebhooks
  ]
});

// Ensure data directory exists
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

client.once('ready', () => {
  console.log('Celestial Artisan\'s bot is online at ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  createLogChannel();
});

async function createLogChannel() {
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('No guild found. Ensure the bot is in a server.');
    return;
  }
  if (!guild.channels.cache.find(ch => ch.name === 'bot-logs')) {
    try {
      await guild.channels.create({
        name: 'bot-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });
      console.log('Created bot-logs channel.');
    } catch (error) {
      console.error('Error creating log channel:', error);
    }
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const guild = message.guild;
  const members = guild.members.cache;

  if (command === 'hello') {
    const target = args[0] ? members.find(m => m.user.username.toLowerCase() === args[0].toLowerCase()) : null;
    if (target) {
      message.channel.send('Hello, ' + target.user.username + '! I\'m here to help!');
    } else {
      message.channel.send('Hello everyone in ' + message.channel.name + '! I\'m your helpful bot!');
    }
  } else if (command === 'suggest') {
    const query = args.join(' ');
    const logPath = `${BASE_DIR}\\suggestions.log`;
    const suggestion = 'Suggestion for "' + query + '": Check RuneScape Wiki or Ely.gg! (AI TBD)';
    message.channel.send(suggestion);
    fs.appendFileSync(logPath, new Date().toISOString() + ' - ' + suggestion + '\n');
    const logChannel = guild.channels.cache.find(ch => ch.name === 'bot-logs');
    if (logChannel) logChannel.send(suggestion);
  } else if (command === 'stats') {
    const stats = { health: 75, level: 99 };
    const logPath = `${BASE_DIR}\\stats.log`;
    message.channel.send('Gameplay Stats: Health ' + stats.health + '%, Level ' + stats.level);
    fs.appendFileSync(logPath, new Date().toISOString() + ' - ' + JSON.stringify(stats) + '\n');
    const logChannel = guild.channels.cache.find(ch => ch.name === 'bot-logs');
    if (logChannel) logChannel.send('Stats: ' + JSON.stringify(stats));
  } else if (command === 'price') {
    const item = args.join(' ');
    try {
      const response = await fetch('https://api.weirdgloop.org/runescape/ge/live?name=' + encodeURIComponent(item));
      const data = await response.json();
      const price = data[item]?.price || 'Not found';
      message.channel.send('Price for ' + item + ': ' + price + ' GP');
    } catch (error) {
      message.channel.send('Error fetching price.');
      console.error('Price fetch error:', error);
    }
  } else if (command === 'help') {
    const helpMessage = 'Available commands: !hello [username], !suggest <text>, !stats, !price <item>, !help, !alt1';
    message.channel.send(helpMessage);
  } else if (command === 'alt1') {
    // Use a configurable local path or ngrok URL to avoid hypothetical links
    const localPath = 'C:\\Users\\krist\\MyBot\\index.html'; // Adjust to your Alt1 app file
    if (fs.existsSync(localPath)) {
      // Start ngrok if not running (requires ngrok installed and in PATH)
      const { exec } = require('child_process');
      exec('ngrok http 80', (err) => {
        if (err) {
          message.channel.send('Error starting ngrok. Ensure it’s installed and run manually.');
          return;
        }
        // This is a simplified approach; in practice, parse ngrok URL dynamically
        const alt1Url = 'https://localhost:80/index.html'; // Replace with actual ngrok URL
        message.channel.send(`Open Alt1 with this link: https://alt1toolkit.com/?app=YOUR_APP_UUID&url=${alt1Url}`);
      });
    } else {
      message.channel.send('Alt1 app file not found. Set a valid path in localPath.');
    }
  }
});

client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('Login failed:', error);
});


