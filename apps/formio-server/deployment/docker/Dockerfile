FROM node:lts-alpine

ENV USERNAME=formiouser
ENV UID=5000
ENV GROUP=${USERNAME}
ENV GID=${UID}

RUN adduser -u ${UID} -g ${GROUP} -D ${USERNAME} &&\
    addgroup ${USERNAME} ${GROUP}

# Cleanup
RUN rm -rf /var/lib/apt/lists/* &&\
    rm -f /etc/fstab &&\
    crontab -r &&\
    find / -name wget -delete &&\
    rm -fr /etc/init.d /lib/rc /etc/conf.d /etc/inittab /etc/runlevels /etc/rc.conf /etc/logrotate.d &&\
    rm -fr /etc/sysctl* /etc/modprobe.d /etc/modules /etc/mdev.conf /etc/acpi && \
    find /bin /etc /lib /sbin /usr -xdev -type f -a \( -perm +4000 -o -perm +2000 \) -delete &&\
    find / -xdev -type l ! -exec test -e {} \; -delete

COPY        ./build /src
WORKDIR     /src

RUN apk add libcap && setcap 'cap_net_bind_service=+ep' $(which node)
USER ${USERNAME}

EXPOSE      80
CMD  ["node", "formio.js"]
