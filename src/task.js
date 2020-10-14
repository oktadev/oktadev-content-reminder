"use strict";

const axios = require( "axios" );
const qs = require( "querystring" );
const LANE_SEARCH_TEXT = "In Progress";
const EXCLUDE_CARD_TYPES = [ "Security" ];
const DAYS_OF_INACTIVITY = 7;
const PING_MESSAGES = [
	"Hey, any update on this?",
	"Hey, how's this one coming along?",
	"Any update on this card?",
	"How's this one coming along?"
];

const getRandomMessage = () => {
	const msg = PING_MESSAGES[Math.floor( Math.random() * PING_MESSAGES.length )];
	return msg;
};

const getClient = () => {
	const { LK_ORGNAME, LK_USERNAME, LK_PASSWORD, LK_BOARDID } = process.env;
	const boardId = LK_BOARDID;
	const baseURL = `https://${ LK_ORGNAME }.leankit.com/io`;
	const auth = {
		username: LK_USERNAME,
		password: LK_PASSWORD
	};

	const api = axios.create( {
		baseURL,
		auth,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json"
		}
	} );

	const getBoard = async () => {
		const res = await api( `board/${ boardId }` );
		return res.data;
	};

	const createComment = async ( cardId, comment ) => {
		const res = await api.post( `card/${ cardId }/comment`, { text: comment } );
		return res.data;
	};

	const getCardsByLane = async ( laneId ) => {
		const params = {
			limit: 200,
			offset: 0,
			lanes: laneId,
			sort: "activity"
		};
		const res = await api( `card/?${ qs.stringify( params ) }` );
		return res.data.cards;
	};

	return {
		getBoard,
		getCardsByLane,
		createComment
	};
};

const test = async() => {
	try {
		// test card https://oktadev.leankit.com/card/1337564431
		const client = getClient();
		const cardId = "1337564431";
		const comment = "@David_Neal How's it going?";
		await client.createComment( cardId, comment );
	} catch ( err ) {
		console.log( err );
	}
};

const run = async () => {
	try {
		const inActiveDate = new Date();
		inActiveDate.setDate( inActiveDate.getDate() - DAYS_OF_INACTIVITY );
		console.log( `Looking for cards older than ${ inActiveDate.toLocaleString() }` );
		const client = getClient();
		const board = await client.getBoard();
		const inProgressLane = board.lanes.find( lane => lane.name === LANE_SEARCH_TEXT );
		if ( !inProgressLane ) {
			throw new Error( `Lane [${ LANE_SEARCH_TEXT }] was not found. Was it renamed?` );
		}
		const cards = await client.getCardsByLane( inProgressLane.id );
		const filteredCards = cards.filter ( c => {
			return !EXCLUDE_CARD_TYPES.includes( c.type.title );
		} );
		const inActiveAssignedCards = filteredCards.filter( c => {
			const updatedOn = new Date( c.updatedOn );
			return updatedOn < inActiveDate && c.assignedUsers.length > 0;
		} );
		console.log( `There are ${ filteredCards.length } DevRel cards in the "${ LANE_SEARCH_TEXT }" column. ${ inActiveAssignedCards.length } of those cards have been inactive for more than ${ DAYS_OF_INACTIVITY } days.` );
		for( const card of inActiveAssignedCards ) {
			const atMentions = card.assignedUsers.map( user => `@${ user.fullName.replace( / /g, "_" ) }` );
			const comment = `${ atMentions.join( " " ) } ${ getRandomMessage() }`;
			console.log( `Sending comment to [${ card.id }] [${ card.title }] [${ comment }]` );
			await client.createComment( card.id, comment );
		}
	} catch ( err ) {
		console.log( err );
	}
};

module.exports =  { run, test };
