MemorableName = (function()
{
	var adjs = [  "Good","New","First","Last","Long","great","little","own","other","old","right","big","high","small","large","next","early","young","few","public","bad","same","able","clean","drab","fancy","long","old-","plain","quaint","wide-eyed","red","orange","yellow","green","blue","purple","gray","black","white","alive","better","clever","dead","easy","famous","gifted","mushy","odd","rich","shy","tender","vast","wrong","brave","calm","eager","gentle","happy","jolly","kind","lively","nice","proud","silly","witty","angry","clumsy","fierce","grumpy","itchy","lazy","scary","broad","chubby","curved","deep","flat","high","hollow","low","narrow","round","skinny","square","steep","wide","big","fat","great","huge","large","little","petite","puny","short","small","tall","teeny","teeny-tiny","tiny","cooing","faint","loud","noisy","quiet","raspy","brief","early","fast","late","long","modern","old","old-","quick","rapid","short","slow","swift","young","bitter","fresh","greasy","juicy","hot","icy","loose","melted","rainy","rotten","salty","sticky","strong","sweet","tart","uneven","weak","wet","wooden","yummy","breeze","broken","bumpy","chilly","cold","cool","creepy","cuddly","curly","damp","dirty","dry","dusty","filthy","flaky","fluffy","hot","warm","wet","empty","few","full","heavy","light","many","sparse" ];

	var nouns = [ "nation", "branch", "gun", "spark", "brass", "title", "hill", "voice", "honey", "show", "celery", "pie", "shelf", "circle", "twist", "cable", "turkey", "push", "plough", "bed", "waves", "front", "chance", "effect", "head", "shirt", "loaf", "horse", "brake", "glove", "night", "silk", "quilt", "neck", "porter", "screw", "prose", "shame", "butter", "worm", "planes", "sort", "rake", "oven", "snails", "arm", "rod", "sponge", "spot", "canvas", "heat", "match", "class", "dock", "nerve", "hand", "plate", "letter", "juice", "day", "talk", "gold", "muscle", "arch", "side", "sister", "shake", "knot", "bikes", "week", "jeans", "house", "jam", "rat", "thumb", "cause", "drop", "book", "giants", "grain", "mouth", "pocket", "wing", "hook", "queen", "size", "skin", "fall", "sleet", "blow", "cactus", "snakes", "quiet", "soap", "war", "border", "wood", "way", "bear", "debt", "cover", "bat", "tramp", "basket", "roll", "fly", "pail", "zinc", "army", "watch", "ants", "sleep", "trade", "fish", "birds", "cloth", "fire", "rate", "steam", "zipper", "cast", "swing", "sheep", "bag", "drink", "sugar", "mom", "credit", "houses", "magic", "table", "space", "throne", "frame", "ear", "lamp", "unit", "hate", "sheet", "cup", "aunt", "cook", "join", "plant", "vase", "person", "profit", "cellar", "trains", "beds", "mother", "son", "price", "smile", "hot", "tin", "ticket", "plot", "wrist", "fact", "soup", "wine", "trees", "top", "snake", "men", "wall", "yard", "grip", "use", "route", "lumber", "year", "chalk", "mask", "nose", "frogs", "power", "fog", "hall", "toes", "dog", "linen", "boot", "yarn", "form", "group", "door", "run", "metal", "tent", "view", "sun", "story" ];

	function get()
	{
		var adj  = adjs[ Math.floor( Math.random() * adjs.length ) ];
		var noun = nouns[ Math.floor( Math.random() * nouns.length ) ];

		return `${adj} ${noun}`;
	}

	return {
		get : get,
	};

}());
