
const dotenv = require('dotenv');
const discord = require('discord.js');
const idletcg = require('./idletcg/idletcg.js');
const tcgdata = require('./idletcg/tcgdata.js');
const tcgplayeractor = require('./idletcg/tcgplayeractor.js');
const random = require('./lib/random.js');
const config = require('./config.js').BooConfig;

const client = new discord.Client();
const game = new idletcg.IdleTcg();
const commandPrefix = config.commandPrefix;
const scanTime = config.scanTime;

client.on('ready', () => {
	game.load();
	client.user.setGame("idletcg: .help");
	console.log('boo: running');
	setInterval(BooSchedule.updateIdleTcg, scanTime * 1000);
});

client.on('message', message => {
	if (message.channel.name !== config.channel ||
		message.content[0] !== commandPrefix) {
		return;
	}
	let command = message.content.substring(1);

	if (command in BooCommands) {
		BooCommands[command](message);
	}
});

class BooSchedule {

	static updateIdleTcg() {
		client.users.forEach(function(user, id, _) {
			if (!game.hasPlayer(id)) return;
			let player = game.getPlayer(id);
			let playerActor = new tcgplayeractor.TcgPlayerActor(player);
			
			playerActor.rewardMoney();
			playerActor.rewardIdlePoints();

			let boosterEarned = playerActor.rewardBooster();
			if (boosterEarned) {
				let idleStr = user + ' has idled for ';
				let idleTime = player.idle + ' seconds, and found a ';
				let desc = tcgdata.boosters[player.booster] + ' ' + tcgdata.boosterDescript;
				let help = '; ' + config.commandPrefix + 'unpack to open';

				let channel = client.channels.find('name', config.channel);
				channel.send(idleStr + idleTime + desc + help);
			}

			player.idle += scanTime;
			player.username = user.username;

			console.log(' --- ');
			console.log('username: ' + player.username);
			console.log('idleTime: ' + player.idle);
			console.log('money: ' + player.money);
			console.log('idlePoints: ' + player.idlePoints);
			console.log(' --- ')
			console.log(' ');
		});

		game.save();
	}

}

class BooCommands {

	static help(context) {
		context.reply('collect pokemon while you idle, type .join to get started!');
	}

	static cards(context) {
		let cards = game.getCards();
		context.reply('there are currently ' + cards + ' cards in circulation');
	}

	static join(context) {
		let user = context.author;
		if (game.hasPlayer(user.id)) {
			context.reply('you are already a registered player!');
		}
		else {
			game.addPlayer(user.id, user.username);
			game.save();
			context.reply('you are now playing idletcg, good luck!');
		}
	}

	static unpack(context) {
		let user = context.author;
		if (!game.hasPlayer(user.id)) {
			context.reply('sorry; you\'re not a registered player, see .help!');
			return;
		}

		let player = game.getPlayer(user.id);
		if (player.booster === false) {
			context.reply('sorry; you don\'t have anything to unpack!');
			return;
		}

		let boosterName = tcgdata.boosters[player.booster];
		let playerActor =  new tcgplayeractor.TcgPlayerActor(player);
		let card = playerActor.openBooster();
		let cards =  Object.keys(player.cards).length;
		if (tcgdata.titles[cards] !== undefined) {
			player.title = tcgdata.titles[cards];
		}
		
		let colour = config.embedColour;
		if (player['colour'] !== undefined) {
			colour = player['colour'];
		}

		let pronoun = 'their';
		if (player['gender'] !== undefined) {
			if (player['gender'] === 'm') {
				pronoun = 'his';
			}
			else {
				pronoun = 'her';
			}
		}

		let avatarURL = config.embedThumbnail;
		if (config.useAvatarsInDropAlerts === true) {
			if (user.avatarURL !== null) {
				avatarURL = user.avatarURL;
			}
		}

		let boosterDescript = tcgdata.boosterDescript.charAt(0).toUpperCase() +
			tcgdata.boosterDescript.slice(1);

		let embed = new discord.RichEmbed()
			.setAuthor(boosterDescript + ': ' + boosterName)
			.setColor(colour)
			.setDescription(user + ' opened ' + pronoun + 
				' ' + tcgdata.boosterDescript +
				' and received card `' + card.id +
				'/' + game.cards + '`')
			.addField('#' + card.id + ': ' + card.text, card.description)
			.setThumbnail(avatarURL)
			.attachFile(card.img);

		let channel = client.channels.find('name', config.channel);
		channel.send({embed});
	}

	static profile(context) {
		let user = context.author;
		if (!game.hasPlayer(user.id)) {
			context.reply('sorry; you\'re not a registered player, see .help!');
			return;
		}

		let player = game.getPlayer(user.id);

		let colour = config.embedColour;
		if (player['colour'] !== undefined) {
			colour = player['colour'];
		}

		let pronoun = 'their';
		if (player['gender'] !== undefined) {
			if (player['gender'] === 'm') {
				pronoun = 'his';
			}
			else {
				pronoun = 'her';
			}
		}

		let avatarURL = config.embedThumbnail;
		if (config.useAvatarsInDropAlerts === true) {
			console.log('this is true');
			if (user.avatarURL !== null) {
				console.log('so is this..');
				avatarURL = user.avatarURL;
			}
		}

		let cards = Object.keys(player.cards).length;
		let completion = Math.round(((cards * 100) / game.cards) * 10) / 10;

		let embed = new discord.RichEmbed()
			.setAuthor(user.username)
			.setColor(colour)
			.setDescription('`' + player.title + '`')
			.addField('Cards', '🗃️ ' + cards + '/' + game.cards +
				' cards found `' + completion + '% complete`')
			.addField('Idle time', '⏰ ' + player.idle + ' seconds')
			.addField('Piggy bank', '💴 ¥' + player.money)
			.setThumbnail(avatarURL);

		if (player.booster !== false) {
			embed.setFooter(user.username + ' hasn\'t opened ' + pronoun + 
				' last ' + tcgdata.boosterDescript)
		}

		let channel = client.channels.find('name', config.channel);
		channel.send({embed});
	}

}

dotenv.config({path: 'boo.env'});
client.login(process.env.BOO_TOKEN);
