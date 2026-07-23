import { useState } from 'react';
import { Dialog, Icon } from './ui';

const steps = [
  {
    title: '今日の流れを、ひとつの画面に',
    description: '今日の目標、タスク、習慣、振り返りを日付ごとにまとめられます。',
    items: [
      { icon: 'tasks', title: 'タスク', text: '「タスクを追加」から予定を登録し、チェックで完了にします。' },
      { icon: 'habits', title: '習慣', text: '続けたいことを登録し、その日の達成をワンタップで記録します。' },
      { icon: 'reflection', title: '振り返り', text: '気分やできたことを残すと、レポートから変化を確認できます。' }
    ]
  },
  {
    title: '記録はこの端末へ自動保存',
    description: 'ログインしなくても使い始められます。設定からクラウド保存へ切り替えられます。',
    items: [
      { icon: 'check', title: 'ローカル保存', text: 'このブラウザ内に保存します。JSONバックアップも作成できます。' },
      { icon: 'cloud', title: 'クラウド保存', text: 'Firebase設定後にログインすると、PCとスマートフォンで同期できます。' },
      { icon: 'bell', title: '通知', text: '設定画面から許可した後、タスクや習慣の時間をお知らせします。' }
    ]
  },
  {
    title: '毎日開きやすい形で使えます',
    description: 'ホーム画面へ追加すると、通常のアプリのように素早く起動できます。',
    items: [
      { icon: 'today', title: '今日から始める', text: '最初はタスクをひとつ追加するだけで大丈夫です。' },
      { icon: 'image', title: 'ホーム画面へ追加', text: '設定の「アプリとして使う」に端末別の手順があります。' },
      { icon: 'settings', title: 'あとから変更', text: 'テーマ、週の開始日、通知、保存方式はいつでも変更できます。' }
    ]
  }
] as const;

export function Onboarding({
  open,
  showSampleNotice,
  onFinish
}: {
  open: boolean;
  showSampleNotice: boolean;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = steps[step];

  const finish = () => {
    setStep(0);
    onFinish();
  };

  return (
    <Dialog open={open} title="今日ノートへようこそ" onClose={finish} closeOnBackdrop={false}>
      <div className="onboarding">
        <div className="onboarding__progress" aria-label={`初回ガイド ${step + 1}/${steps.length}`}>
          {steps.map((item, index) => (
            <span key={item.title} className={index <= step ? 'is-active' : ''} />
          ))}
        </div>
        <header>
          <span>{step + 1} / {steps.length}</span>
          <h3>{current.title}</h3>
          <p>{current.description}</p>
        </header>
        <div className="onboarding__items">
          {current.items.map((item) => (
            <article key={item.title}>
              <span aria-hidden="true"><Icon name={item.icon} /></span>
              <div><strong>{item.title}</strong><p>{item.text}</p></div>
            </article>
          ))}
        </div>
        {showSampleNotice && step === 0 && (
          <p className="onboarding__sample">
            「筋トレ20分」「Python学習」「ITパスポートの勉強」は操作を試すためのサンプルです。不要な場合は習慣画面から削除できます。
          </p>
        )}
        <div className="dialog__actions onboarding__actions">
          <button className="button button--text" type="button" onClick={finish}>スキップ</button>
          {step > 0 && <button className="button button--ghost" type="button" onClick={() => setStep((value) => value - 1)}>戻る</button>}
          {step < steps.length - 1
            ? <button className="button button--primary" type="button" onClick={() => setStep((value) => value + 1)}>次へ</button>
            : <button className="button button--primary" type="button" onClick={finish}>今日ノートを始める</button>}
        </div>
      </div>
    </Dialog>
  );
}
