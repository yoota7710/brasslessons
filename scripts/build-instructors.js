#!/usr/bin/env node
/*
  강사 경력 정보는 data/instructors.json 한 곳에서만 관리합니다.
  경력을 수정할 때는 이 스크립트를 직접 고치지 말고 data/instructors.json을 수정한 뒤
  아래 명령으로 index.html / trumpet-trombone-teacher.html을 다시 생성하세요.

    node scripts/build-instructors.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const START = '<!-- INSTRUCTOR_CARDS:START -->';
const END = '<!-- INSTRUCTOR_CARDS:END -->';

const instructors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'instructors.json'), 'utf8'));

function renderCareerGroup(group) {
  const items = group.items.map((item) => `<li>${item}</li>`).join('');
  return [
    '            <div class="career-group">',
    `              <h3>${group.title}</h3>`,
    `              <ul>${items}</ul>`,
    '            </div>',
  ].join('\n');
}

function renderCard(instructor, nameTag) {
  const groups = instructor.careerGroups.map(renderCareerGroup).join('\n');
  return [
    `      <div class="instructor-card ${instructor.instrumentClass}">`,
    '        <div class="instructor-visual">',
    `          <img src="${instructor.image}" alt="${instructor.alt}">`,
    '        </div>',
    '        <div class="instructor-info">',
    `          <span class="instructor-role">${instructor.role}</span>`,
    `          <${nameTag}>${instructor.name}</${nameTag}>`,
    `          <p class="bio-quote">"${instructor.quote}"</p>`,
    `          <p class="bio">${instructor.bio}</p>`,
    '          <div class="career">',
    '            <p class="career-title">경력</p>',
    groups,
    '          </div>',
    `          <a href="${instructor.kakaoLink}" target="_blank" rel="noopener" class="btn btn-kakao btn-sm">${instructor.kakaoLabel}</a>`,
    '        </div>',
    '      </div>',
  ].join('\n');
}

function renderCards(nameTag) {
  return instructors.map((instructor) => renderCard(instructor, nameTag)).join('\n');
}

const targets = [
  { file: 'index.html', nameTag: 'h3' },
  { file: 'trumpet-trombone-teacher.html', nameTag: 'h2' },
];

for (const { file, nameTag } of targets) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    console.error(`마커(${START} / ${END})를 찾을 수 없습니다: ${file}`);
    process.exit(1);
  }
  const before = html.slice(0, startIdx + START.length);
  const after = html.slice(endIdx);
  const next = `${before}\n${renderCards(nameTag)}\n      ${after}`;
  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`업데이트됨: ${file}`);
}
