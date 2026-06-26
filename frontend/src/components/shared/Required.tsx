interface RequiredProps {
    /**
     * Optional message to display after the asterisk
     */
    message?: string
}

/**
 * 
 * @param message Optional message to display after the asterisk
 * @returns 
 */


export const Required = ({ message }: RequiredProps) => {
    return (
        <span className="text-red-500">* {message}</span>
    )
}