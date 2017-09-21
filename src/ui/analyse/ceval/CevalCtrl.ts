import settings from '../../../settings'
import cevalEngine from './cevalEngine'
import { getNbCores } from '../../../utils/stockfish'
import { Tree } from '../../shared/tree'
import { Work, ICevalCtrl } from './interfaces'

export default function CevalCtrl(
  variant: VariantKey,
  allowed: boolean,
  emit: (res: Tree.ClientEval, work: Work) => void
): ICevalCtrl {

  let initialized = false

  const minDepth = 8
  const maxDepth = 20
  const multiPv = 3
  const cores = getNbCores()

  const engine = cevalEngine({ minDepth, maxDepth, cores, multiPv })

  let started = false
  let isEnabled = settings.analyse.enableCeval()

  function enabled() {
    return allowed && isEnabled
  }

  function onEmit(res: Tree.ClientEval, work: Work) {
    emit(res, work)
  }

  function start(path: Tree.Path, steps: Tree.Node[]) {
    if (!enabled()) {
      return
    }
    const step = steps[steps.length - 1]
    if (step.ceval && step.ceval.depth >= maxDepth) {
      return
    }
    const work = {
      initialFen: steps[0].fen,
      currentFen: step.fen,
      moves: steps.slice(1).map((s) => fixCastle(s.uci!, s.san!)),
      maxDepth,
      path,
      ply: step.ply,
      multiPv,
      threatMode: false,
      emit(res: Tree.ClientEval) {
        if (enabled()) onEmit(res, work)
      }
    }

    engine.start(work)
    started = true
  }

  function stop() {
    if (!enabled() || !started) return
    engine.stop()
    started = false
  }

  function destroy() {
    if (initialized) {
      engine.exit()
      .then(() => {
        initialized = false
      })
      .catch(() => {
        initialized = false
      })
    }
  }

  function fixCastle(uci: string, san: string) {
    if (san.indexOf('O-O') !== 0) return uci
    switch (uci) {
      case 'e1h1':
        return 'e1g1'
      case 'e1a1':
        return 'e1c1'
      case 'e8h8':
        return 'e8g8'
      case 'e8a8':
        return 'e8c8'
    }
    return uci
  }

  return {
    init() {
      return engine.init(variant).then(() => {
        initialized = true
      })
    },
    isInit() {
      return initialized
    },
    cores,
    multiPv,
    variant,
    start,
    stop,
    destroy,
    allowed,
    enabled,
    toggle() {
      isEnabled = settings.analyse.enableCeval()
    }
  }
}