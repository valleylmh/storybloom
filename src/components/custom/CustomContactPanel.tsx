import CustomIcon from "@/components/custom/CustomIcon";
import type { CustomOrderPlatform } from "@/lib/custom-order";

interface CustomContactPanelProps {
  platforms: CustomOrderPlatform[];
}

export default function CustomContactPanel({ platforms }: CustomContactPanelProps) {
  return (
    <div className="custom-contact-panel" aria-label="联系咨询">
      <div>
        <strong>想做哪一版？先配置你自己的咨询入口</strong>
        <span>
          开源版本不包含私人联系方式；部署者可以通过环境变量添加自己的下单或咨询链接。
        </span>
      </div>
      <div className="custom-contact-actions">
        {platforms.length > 0 ? (
          platforms.map((platform) => (
            <a
              key={platform.id}
              className={`custom-order-link custom-order-link-${platform.id}`}
              href={platform.url}
              target="_blank"
              rel="noreferrer"
            >
              <CustomIcon name="chat" />
              {platform.actionLabel}
            </a>
          ))
        ) : (
          <span className="custom-order-link custom-order-link-disabled">
            尚未配置咨询链接
          </span>
        )}
      </div>
    </div>
  );
}
