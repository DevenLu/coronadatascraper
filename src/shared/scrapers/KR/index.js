import assert from 'assert';
import * as fetch from '../../lib/fetch/index.js';
import * as parse from '../../lib/parse.js';
import * as transform from '../../lib/transform.js';
import getKey from '../../utils/get-key.js';
import maintainers from '../../lib/maintainers.js';

const labelFragmentsByKey = [
  { discard: 'daily change' },
  { discard: 'imported cases' },
  { discard: 'local outbreak' },
  { discard: 'isolated' },
  { discard: 'incidence' },
  { cases: 'confirmed cases' },
  { deaths: 'deceased' },
  { state: 'name of state' },
  { recovered: 'released from quarantine' }
];

const UNASSIGNED = '(unassigned)';

const countryLevelMap = {
  Busan: 'iso2:KR-26',
  'Chungcheongbuk-do': 'iso2:KR-43',
  'Chungcheongnam-do': 'iso2:KR-44',
  Daegu: 'iso2:KR-27',
  Daejeon: 'iso2:KR-30',
  'Gangwon-do': 'iso2:KR-42',
  Gwangju: 'iso2:KR-29',
  'Gyeonggi-do': 'iso2:KR-41',
  'Gyeongsangbuk-do': 'iso2:KR-47',
  'Gyeongsangnam-do': 'iso2:KR-48',
  Incheon: 'iso2:KR-28',
  Jeju: 'iso2:KR-49',
  'Jeollabuk-do': 'iso2:KR-45',
  'Jeollanam-do': 'iso2:KR-46',
  Sejong: 'iso2:KR-50',
  Seoul: 'iso2:KR-11',
  Ulsan: 'iso2:KR-31',
  Lazaretto: UNASSIGNED // Maritime quarantine
};

const scraper = {
  country: 'iso1:KR',
  aggregate: 'state', // Special cities have equal status to states.
  type: 'table',
  url: 'http://ncov.mohw.go.kr/en/bdBoardList.do?brdId=16&brdGubun=162&dataGubun=&ncvContSeq=&contSeq=&board_id=',
  sources: [
    {
      url: 'http://ncov.mohw.go.kr/',
      name: 'Ministry of Health and Welfare'
    }
  ],
  maintainers: [
    {
      name: 'Jacob McGowan',
      github: 'jacobmcgowan'
    },
    maintainers.camjc
  ],
  async scraper() {
    const $ = await fetch.page(this.url);
    const $table = $('table.num');

    const states = [];
    const $headings = $table.find('thead tr:last-child th');
    const headingOffset = $table.find('thead tr:first-child th[rowspan="2"]').length - 1; // -1 for the th in each province row.

    const dataKeysByColumnIndex = [];

    $headings.each((index, heading) => {
      const $heading = $(heading);
      const label = $heading.text();
      const key = getKey({ label, labelFragmentsByKey });
      dataKeysByColumnIndex[index + headingOffset] = key;
    });

    const $provinceRows = $table.find('tbody > tr:not(.sumline)');

    $provinceRows.each((_rowIndex, row) => {
      const $row = $(row);
      const province = parse.string($row.find('th').text());
      const $tds = $row.find('td');

      const data = {};
      $tds.each((columnIndex, td) => {
        const $td = $(td);
        const key = dataKeysByColumnIndex[columnIndex];
        data[key] = parse.number($td.text().replace('-', 0));
      });

      const mappedState = countryLevelMap[province];
      assert(mappedState, `state has no mapping: ${province}`);

      states.push({
        ...data,
        state: mappedState
      });
    });

    const summedData = transform.sumData(states);
    states.push(summedData);
    assert(summedData.cases > 0, 'Cases is not reasonable');

    return states;
  }
};

export default scraper;
