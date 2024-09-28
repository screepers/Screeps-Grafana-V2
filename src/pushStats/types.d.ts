type UserType = "mmo"|"season"|"private";

interface UserInfo {    
    type: UserType;
    username: string;
    host: string;
    replaceName: string;
    password: string;
    token: string;
    prefix: string;
    segment: number;
    shards: string[];
}
