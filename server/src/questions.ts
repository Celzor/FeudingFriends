import { parse } from "csv-parse";

import { IQuestionType } from "../../types";

async function parseCSVPromise(csvFile: string) {
  const records: any = await new Promise((resolve, reject) => {
    try {
      const records: any = [];

      const parser = parse({ columns: true });

      parser.on("readable", function () {
        let record: any;
        while ((record = parser.read())) {
          records.push(record);
        }
      });

      parser.on("end", async function () {
        // console.log("done parsing", records);
        resolve(records);
        //await seedQuestions(records);
      });

      require("fs").createReadStream(csvFile).pipe(parser);
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });

  // parse them into good format
  const data: IQuestionType[] = records.map((record: any) => {
    const outQuestionObject: IQuestionType = {
      question: "",
      answers: [],
    };

    const keeeys = Object.keys(record);

    // console.log("QUESTION", record[keeeys[0]]);

    outQuestionObject.question = record[keeeys[0]];

    // keys from 1 onwwards should be pairs of answers and score
    if (csvFile === './data/1.csv' || csvFile === './data/2.csv') {
      // If csvFile is 'csv1.csv' or 'csv2.csv', get just the question and the answers
      for (let i = 1; i < keeeys.length; i++) {
        outQuestionObject.answers.push({
          answerText: record[keeeys[i]],
          answerScore: null
        });
      }
    } else {
    for (let i = 1; i < keeeys.length; i += 2) {
      // console.log("ANSWER", record[keeeys[i]], record[keeeys[i + 1]]);
      outQuestionObject.answers.push({
        answerText: record[keeeys[i]],
        answerScore: parseInt(record[keeeys[i + 1]]),
      });
    }
  }

    return outQuestionObject;
  });

  return data;
}

export async function getQuestionPools(): Promise<{
  [key: number]: IQuestionType[];
}> {
  const questions = {};
/*********************************
 * 
 * FIRST 2 CSV FILES ARE FOR LIGHTNING ROUND ONLY
 * 
 */
  const csvFile1 = await parseCSVPromise("./data/1.csv");
  // console.log("CSV FILE 1", csvFile1.length, csvFile1[0]); 
  // await insertQuestions(csvFile1, 1);
  questions[1] = csvFile1;

  const csvFile2 = await parseCSVPromise("./data/2.csv");
  // console.log("CSV FILE 2", csvFile2.length, csvFile2[0]);
  // await insertQuestions(csvFile2, 2);
  questions[2] = csvFile2;


  const csvFile3 = await parseCSVPromise("./data/3.csv");
  // console.log("CSV FILE 3", csvFile3.length, csvFile3[0]);
  // await insertQuestions(csvFile3, 3);
  questions[3] = csvFile3;

  const csvFile4 = await parseCSVPromise("./data/4.csv");
  // console.log("CSV FILE 4", csvFile4.length, csvFile4[0]);
  // await insertQuestions(csvFile4, 4);
  questions[4] = csvFile4;

  const csvFile5 = await parseCSVPromise("./data/5.csv");
  // console.log("CSV FILE 5", csvFile5.length, csvFile5[0]);
  // await insertQuestions(csvFile5, 5);
  questions[5] = csvFile5;

  const csvFile6 = await parseCSVPromise("./data/6.csv");
  // console.log("CSV FILE 6", csvFile6.length, csvFile6[0]);
  // await insertQuestions(csvFile6, 6);
  questions[6] = csvFile6;

  const csvFile7 = await parseCSVPromise("./data/7.csv");
  // console.log("CSV FILE 7", csvFile7.length, csvFile7[0]);
  // await insertQuestions(csvFile7, 7);
  questions[7] = csvFile7;

  return questions;
}
