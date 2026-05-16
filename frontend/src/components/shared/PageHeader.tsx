import type { ReactNode } from "react";

import AppPageHeader from "@/components/shared/AppPageHeader";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  breadcrumbs?: ReactNode;
  meta?: ReactNode;
  breadcrumbActions?: ReactNode;
}

const PageHeader = ({
  title,
  subtitle,
  actions,
  className = "",
  breadcrumbs,
  meta,
  breadcrumbActions,
}: PageHeaderProps) => {
  return (
    <AppPageHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      breadcrumbs={breadcrumbs}
      meta={meta}
      breadcrumbActions={breadcrumbActions}
      className={className}
      headingClassName="text-2xl sm:text-4xl capitalize"
    />
  );
};

export default PageHeader;
