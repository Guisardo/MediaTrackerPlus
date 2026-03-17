"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
const http_client_1 = require("./generated/http-client");
const Calendar_1 = require("./generated/Calendar");
const Configuration_1 = require("./generated/Configuration");
const Details_1 = require("./generated/Details");
const Group_1 = require("./generated/Group");
const Id_1 = require("./generated/Id");
const ImportGoodreads_1 = require("./generated/ImportGoodreads");
const ImportTrakttv_1 = require("./generated/ImportTrakttv");
const Items_1 = require("./generated/Items");
const List_1 = require("./generated/List");
const ListItem_1 = require("./generated/ListItem");
const Lists_1 = require("./generated/Lists");
const Logs_1 = require("./generated/Logs");
const Plex_1 = require("./generated/Plex");
const Progress_1 = require("./generated/Progress");
const Rating_1 = require("./generated/Rating");
const Search_1 = require("./generated/Search");
const Seen_1 = require("./generated/Seen");
const Statistics_1 = require("./generated/Statistics");
const Tokens_1 = require("./generated/Tokens");
const User_1 = require("./generated/User");
const Users_1 = require("./generated/Users");
const Watchlist_1 = require("./generated/Watchlist");
__exportStar(require("./generated/data-contracts"), exports);
__exportStar(require("./generated/http-client"), exports);
__exportStar(require("./generated/CalendarRoute"), exports);
__exportStar(require("./generated/ConfigurationRoute"), exports);
__exportStar(require("./generated/DetailsRoute"), exports);
__exportStar(require("./generated/GroupRoute"), exports);
__exportStar(require("./generated/IdRoute"), exports);
__exportStar(require("./generated/ImportGoodreadsRoute"), exports);
__exportStar(require("./generated/ImportTrakttvRoute"), exports);
__exportStar(require("./generated/ItemsRoute"), exports);
__exportStar(require("./generated/ListItemRoute"), exports);
__exportStar(require("./generated/ListsRoute"), exports);
__exportStar(require("./generated/LogsRoute"), exports);
__exportStar(require("./generated/PlexRoute"), exports);
__exportStar(require("./generated/ProgressRoute"), exports);
__exportStar(require("./generated/RatingRoute"), exports);
__exportStar(require("./generated/SearchRoute"), exports);
__exportStar(require("./generated/StatisticsRoute"), exports);
__exportStar(require("./generated/TokensRoute"), exports);
__exportStar(require("./generated/UserRoute"), exports);
__exportStar(require("./generated/UsersRoute"), exports);
__exportStar(require("./generated/WatchlistRoute"), exports);
class Api extends http_client_1.HttpClient {
    constructor(apiConfig = {}) {
        super(apiConfig);
        this.calendar = new Calendar_1.Calendar(this);
        this.configuration = new Configuration_1.Configuration(this);
        this.group = new Group_1.Group(this);
        this.id = new Id_1.Id(this);
        this.details = new Details_1.Details(this);
        this.items = new Items_1.Items(this);
        this.list = new List_1.List(this);
        this.listItem = new ListItem_1.ListItem(this);
        this.lists = new Lists_1.Lists(this);
        this.logs = new Logs_1.Logs(this);
        this.plex = new Plex_1.Plex(this);
        this.progress = new Progress_1.Progress(this);
        this.rating = new Rating_1.Rating(this);
        this.search = new Search_1.Search(this);
        this.seen = new Seen_1.Seen(this);
        this.statistics = new Statistics_1.Statistics(this);
        this.tokens = new Tokens_1.Tokens(this);
        this.user = new User_1.User(this);
        this.users = new Users_1.Users(this);
        this.watchlist = new Watchlist_1.Watchlist(this);
        this.importGoodreads = new ImportGoodreads_1.ImportGoodreads(this);
        this.importTrakttv = new ImportTrakttv_1.ImportTrakttv(this);
    }
}
exports.Api = Api;
