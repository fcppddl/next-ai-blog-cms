# Live2D 资源文件

## Cubism Core（已自动处理）

Cubism 4 Core 已通过官方 CDN 自动加载，无需手动下载：
`https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js`

## 下载模型

从 Live2D 官网下载免费示例模型：
https://www.live2d.com/download/sample-data/

推荐下载 **Haru**（晴）模型。下载解压后，将全部文件放入：
```
public/live2d/haru/
```

最终目录结构：
```
public/live2d/haru/
├── haru.model3.json       # 模型定义
├── haru.moc3              # 骨骼数据
├── textures/              # 贴图（含 png）
├── motions/               # 动作动画
└── haru.physics3.json     # 物理模拟（可选）
```

## 验证

```bash
ls public/live2d/haru/haru.model3.json
```

## 注意事项

- 模型文件不会被 git 追踪（已加入 .gitignore）
- 没有模型文件时，组件自动降级为静态 Bot 图标，不影响正常使用
- 更换模型只需修改 `ai-chat.tsx` 中 `Live2DBot` 的 `modelPath` 属性
