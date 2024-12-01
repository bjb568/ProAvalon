import { a } from './a';
import { aemailtousername } from './aemailtousername';
import { aip } from './aip';
import { aresetpassword } from './aresetpassword';
import { Commands } from '../types';
import { atestgame } from './atestgame';
import { acreatetestaccounts } from './acreatetestaccounts';
import { aresettournamentaccounts } from './aresettournamentaccounts';
import { ausernametoemail } from './ausernametoemail';
import { asessions } from './asessions';

export const adminCommands: Commands = {
  [a.command]: a,
  [acreatetestaccounts.command]: acreatetestaccounts,
  [aemailtousername.command]: aemailtousername,
  [aip.command]: aip,
  [aresettournamentaccounts.command]: aresettournamentaccounts,
  [aresetpassword.command]: aresetpassword,
  [atestgame.command]: atestgame,
  [asessions.command]: asessions,
  [ausernametoemail.command]: ausernametoemail,
};
